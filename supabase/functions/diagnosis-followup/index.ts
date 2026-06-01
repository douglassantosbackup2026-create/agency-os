/**
 * Reavalia métricas de conta 30d após diagnóstico (esboço — sem re-IA).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertCronOrUser } from "../_shared/cron-auth.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { num } from "../_shared/diagnosis/campaign-objective.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

async function fetchAccountInsights(
  actId: string,
  token: string,
): Promise<Record<string, unknown>> {
  const fields =
    "spend,impressions,reach,frequency,actions,action_values,account_currency";
  const url =
    `https://graph.facebook.com/v21.0/${actId}/insights?date_preset=last_30d&fields=${fields}&access_token=${encodeURIComponent(token)}`;
  const r = await fetch(url);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  const row = Array.isArray(j.data) ? j.data[0] : j.data;
  return (row ?? {}) as Record<string, unknown>;
}

function roasFromInsights(ins: Record<string, unknown>): number | null {
  const spend = num(ins.spend) ?? 0;
  let revenue = 0;
  const values = ins.action_values;
  if (Array.isArray(values)) {
    for (const v of values) {
      const row = v as Record<string, unknown>;
      if (String(row.action_type ?? "").includes("purchase")) {
        revenue += num(row.value) ?? 0;
      }
    }
  }
  if (spend <= 0 || revenue <= 0) return null;
  return revenue / spend;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const traceId = traceIdFromRequest(req);
  const sb = diagnosisServiceClient();
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  if (!(await assertCronOrUser(req, admin))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const limit = Math.min(20, Number(Deno.env.get("DIAGNOSIS_FOLLOWUP_BATCH") ?? "10") || 10);
  const { data: jobs } = await sb
    .from("diagnosis_followup_jobs")
    .select("id, diagnosis_id")
    .eq("status", "pending")
    .lte("due_at", new Date().toISOString())
    .limit(limit);

  let processed = 0;
  for (const job of jobs ?? []) {
    const diagnosisId = job.diagnosis_id as string;
    const { data: diag } = await sb
      .from("diagnoses")
      .select("meta_ad_account_id")
      .eq("id", diagnosisId)
      .maybeSingle();
    const actId = diag?.meta_ad_account_id as string | null;
    if (!actId) {
      await sb
        .from("diagnosis_followup_jobs")
        .update({ status: "skipped", outcome_json: { reason: "no_account" } })
        .eq("id", job.id);
      continue;
    }

    const { data: snap } = await sb
      .from("diagnosis_metric_snapshots")
      .select("*")
      .eq("diagnosis_id", diagnosisId)
      .maybeSingle();

    const { data: sec } = await sb
      .from("diagnosis_secrets")
      .select("access_token")
      .eq("diagnosis_id", diagnosisId)
      .maybeSingle();
    const token = sec?.access_token as string | undefined;
    if (!token) {
      await sb
        .from("diagnosis_followup_jobs")
        .update({ status: "skipped", outcome_json: { reason: "no_token" } })
        .eq("id", job.id);
      continue;
    }

    try {
      const ins = await fetchAccountInsights(actId, token);
      const spend = num(ins.spend) ?? 0;
      const roas = roasFromInsights(ins);
      const prevSpend = Number(snap?.spend_30d ?? 0);
      const prevRoas = snap?.roas_sales != null ? Number(snap.roas_sales) : null;
      let label: "improved" | "flat" | "worse" = "flat";
      if (prevRoas != null && roas != null) {
        const delta = roas - prevRoas;
        if (delta > 0.15) label = "improved";
        else if (delta < -0.15) label = "worse";
      }
      await sb
        .from("diagnosis_followup_jobs")
        .update({
          status: "done",
          outcome_json: {
            label,
            spend_30d: spend,
            roas_sales: roas,
            delta_spend: spend - prevSpend,
            delta_roas: prevRoas != null && roas != null ? roas - prevRoas : null,
            evaluated_at: new Date().toISOString(),
          },
        })
        .eq("id", job.id);
      processed++;
    } catch (e) {
      console.warn(`[diagnosis-followup] ${diagnosisId}: ${String(e).slice(0, 200)}`);
    }
  }

  traceLog("diagnosis_followup.done", { processed }, traceId);
  return jsonResponse({ processed });
});
