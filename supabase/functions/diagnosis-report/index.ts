import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import {
  isManagementCtaEligible,
  parseSpendFromFacts,
} from "../_shared/diagnosis/management-eligibility.ts";
import { assertDiagnosisSecret } from "../_shared/diagnosis/validate-diagnosis-access.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "diagnosis_report");
  if (req.method !== "GET")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const d = url.searchParams.get("d") ?? "";
  const s = url.searchParams.get("s") ?? "";
  const gate = await assertDiagnosisSecret(d, s);
  if (!gate.ok) return jsonResponse({ error: gate.message }, gate.status);

  const sb = diagnosisServiceClient();
  const { data: diag } = await sb
    .from("diagnoses")
    .select(
      "status, completed_at, failed_reason, management_status, management_paid_at, management_business_name, management_website, management_instagram, business_context",
    )
    .eq("id", d)
    .single();

  const { data: rep } = await sb
    .from("diagnosis_reports")
    .select("analysis_json, facts_json, prompt_version")
    .eq("diagnosis_id", d)
    .maybeSingle();

  const factsJson = rep?.facts_json;
  const spendLast30d = parseSpendFromFacts(factsJson);

  trace.done({ diagnosis_id: d });
  return jsonResponse({
    diagnosis: diag,
    report: rep
      ? {
          analysis_json: rep.analysis_json,
          prompt_version: rep.prompt_version,
          facts_summary: summarizeFacts(factsJson),
          management_cta_eligible: isManagementCtaEligible(factsJson),
          spend_last_30d: spendLast30d,
        }
      : null,
  });
});

function summarizeFacts(facts: unknown): Record<string, unknown> | null {
  if (!facts || typeof facts !== "object") return null;
  const f = facts as Record<string, unknown>;
  const ins = f.account_insights as Record<string, unknown> | undefined;
  const camps = f.campaigns_sample as unknown[] | undefined;
  const mix = f.objective_spend_mix as Record<string, number> | undefined;
  const enriched = f.campaigns_enriched as unknown[] | undefined;
  return {
    generated_at: f.generated_at,
    campaigns_count: Array.isArray(camps) ? camps.length : 0,
    campaigns_enriched_count: Array.isArray(enriched) ? enriched.length : 0,
    objective_spend_mix: mix ?? null,
    impressions: ins?.impressions,
    spend: ins?.spend,
    ctr: ins?.ctr,
  };
}
