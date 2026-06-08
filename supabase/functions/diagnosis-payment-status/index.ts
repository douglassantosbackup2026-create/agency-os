import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";
import {
  ensureBuyerAccountAndToken,
  fetchBuyerDiagnosis,
} from "../_shared/diagnosis/buyer-account.ts";

const DIAGNOSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
      console.error("diagnosis-payment-status: ensureBuyerAccount failed", e);
    }
    return "awaiting_connection";
  } catch (e) {
    console.error("diagnosis-payment-status: MP reconcile failed", e);
    return null;
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "diagnosis_payment_status");
  if (req.method !== "GET")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const d = url.searchParams.get("d") ?? "";
  const s = url.searchParams.get("s") ?? "";
  if (!DIAGNOSIS_ID_RE.test(d) || !s) {
    return jsonResponse({ error: "parâmetros inválidos" }, 400);
  }

  const sb = diagnosisServiceClient();
  const ip = publicClientIp(req);
  if (await publicRateLimitExceeded(sb, `diagnosis-status:${ip}:${d}`)) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
  }

  const { data } = await sb
    .from("diagnoses")
    .select("status, secret_slug, mp_payment_id")
    .eq("id", d)
    .maybeSingle();

  if (!data || data.secret_slug !== s) {
    return jsonResponse({ error: "não encontrado" }, 404);
  }

  let status = data.status as string | null;
  if (status === "awaiting_payment" && data.mp_payment_id) {
    const reconciled = await reconcileWithMp(sb, d, String(data.mp_payment_id));
    if (reconciled) status = reconciled;
  }

  // If payment confirmed, surface the one-shot auto-login token (then clear it).
  let autoLoginToken: string | null = null;
  if (status && status !== "awaiting_payment") {
    const { data: sec } = await sb
      .from("diagnosis_secrets")
      .select("auto_login_token, auto_login_expires_at")
      .eq("diagnosis_id", d)
      .maybeSingle();
    if (sec?.auto_login_token && sec.auto_login_expires_at) {
      const exp = new Date(sec.auto_login_expires_at).getTime();
      if (exp > Date.now()) {
        autoLoginToken = sec.auto_login_token as string;
        // single-use: clear so reload doesn't replay
        await sb
          .from("diagnosis_secrets")
          .update({ auto_login_token: null, auto_login_expires_at: null })
          .eq("diagnosis_id", d);
      }
    }
  }

  trace.done({ status });
  return jsonResponse({ status, auto_login_token: autoLoginToken });
});
