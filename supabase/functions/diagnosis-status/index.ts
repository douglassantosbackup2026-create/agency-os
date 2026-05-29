import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertDiagnosisSecret } from "../_shared/diagnosis/validate-diagnosis-access.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import {
  ensureBuyerAccountAndToken,
  fetchBuyerDiagnosis,
} from "../_shared/diagnosis/buyer-account.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";

// Fallback reconciliation in case the MP webhook never arrives (network,
// signature mismatch, dev environment, etc.). When the diagnosis still
// shows awaiting_payment but already has an mp_payment_id, query MP and
// flip the status if the payment was actually approved.
async function reconcileWithMp(
  sb: ReturnType<typeof diagnosisServiceClient>,
  diagnosisId: string,
  mpPaymentId: string,
): Promise<string | null> {
  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return null;
  try {
    const r = await fetch(
      `https://api.mercadopago.com/v1/payments/${mpPaymentId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { status?: string };
    if (j.status !== "approved") return null;

    await sb
      .from("diagnoses")
      .update({ status: "awaiting_connection" })
      .eq("id", diagnosisId)
      .eq("status", "awaiting_payment");

    try {
      const diag = await fetchBuyerDiagnosis(sb, diagnosisId);
      if (diag) await ensureBuyerAccountAndToken(sb, diag);
    } catch (e) {
      console.error("diagnosis-status: ensureBuyerAccount failed", e);
    }
    return "awaiting_connection";
  } catch (e) {
    console.error("diagnosis-status: MP reconcile failed", e);
    return null;
  }
}

function triggerProcessDiagnosis(): void {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return;
  const base = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  // fire-and-forget; do not await
  fetch(`${base}/functions/v1/process-diagnosis`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  }).catch(() => undefined);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "diagnosis_status");
  if (req.method !== "GET")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const d = url.searchParams.get("d") ?? "";
  const s = url.searchParams.get("s") ?? "";
  const gate = await assertDiagnosisSecret(d, s);
  if (!gate.ok) return jsonResponse({ error: gate.message }, gate.status);

  const sb = diagnosisServiceClient();
  const { data } = await sb
    .from("diagnoses")
    .select(
      "status, failed_reason, completed_at, mp_payment_id, meta_ad_account_id, management_status, management_paid_at, management_business_name, management_website, management_instagram",
    )
    .eq("id", d)
    .single();

  let status = data?.status ?? null;

  if (status === "awaiting_payment" && data?.mp_payment_id) {
    const reconciled = await reconcileWithMp(sb, d, String(data.mp_payment_id));
    if (reconciled) status = reconciled;
  }

  // Auto-recovery: if stuck in processing and Meta is connected, nudge
  // process-diagnosis (idempotent — checks facts/analysis state internally).
  if (status === "processing" && data?.meta_ad_account_id) {
    triggerProcessDiagnosis();
  }

  trace.done({ status });
  return jsonResponse({
    status,
    failed_reason: data?.failed_reason ?? null,
    completed_at: data?.completed_at ?? null,
    meta_ad_account_id: data?.meta_ad_account_id ?? null,
    management_status: data?.management_status ?? null,
    management_paid_at: data?.management_paid_at ?? null,
    management_business_name: data?.management_business_name ?? null,
    management_website: data?.management_website ?? null,
    management_instagram: data?.management_instagram ?? null,
  });
});
