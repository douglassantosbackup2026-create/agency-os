import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { num } from "./campaign-objective.ts";

export async function recordDiagnosisFollowup(
  sb: SupabaseClient,
  diagnosisId: string,
  facts: Record<string, unknown> | null,
  analysis: Record<string, unknown> | null,
): Promise<void> {
  const ins = (facts?.account_insights ?? {}) as Record<string, unknown>;
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
  const roas = spend > 0 && revenue > 0 ? revenue / spend : null;
  const score = typeof analysis?.score === "number" ? analysis.score : null;
  const digest = {
    account_insights: {
      spend,
      impressions: ins.impressions,
      reach: ins.reach,
      frequency: ins.frequency,
    },
    objective_spend_mix: facts?.objective_spend_mix ?? null,
  };

  const capturedAt = new Date().toISOString();
  await sb.from("diagnosis_metric_snapshots").upsert({
    diagnosis_id: diagnosisId,
    captured_at: capturedAt,
    spend_30d: spend,
    revenue_30d: revenue > 0 ? revenue : null,
    roas_sales: roas,
    score,
    facts_digest: digest,
  });

  const due = new Date();
  due.setDate(due.getDate() + 30);
  const { data: existing } = await sb
    .from("diagnosis_followup_jobs")
    .select("id")
    .eq("diagnosis_id", diagnosisId)
    .eq("status", "pending")
    .maybeSingle();

  if (!existing) {
    await sb.from("diagnosis_followup_jobs").insert({
      diagnosis_id: diagnosisId,
      due_at: due.toISOString(),
      status: "pending",
    });
  }
}
