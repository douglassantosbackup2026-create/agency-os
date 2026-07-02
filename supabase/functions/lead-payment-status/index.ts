import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";
import { notifyLeadPaid } from "../_shared/lead-paid-hook.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function reconcileLeadWithMp(
  sb: ReturnType<typeof diagnosisServiceClient>,
  leadId: string,
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

    const paidAt = new Date().toISOString();
    const { error: upErr } = await sb
      .from("ecommerce_leads")
      .update({
        status: "paid",
        mp_payment_id: mpPaymentId,
        paid_at: paidAt,
      })
      .eq("id", leadId)
      .eq("status", "awaiting_payment");

    if (upErr) {
      console.error("lead-payment-status reconcile update", upErr);
      return null;
    }

    try {
      await notifyLeadPaid(sb, leadId);
    } catch (e) {
      console.error("lead-payment-status notifyLeadPaid failed", e);
    }

    return "paid";
  } catch (e) {
    console.error("lead-payment-status: MP reconcile failed", e);
    return null;
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "lead_payment_status");
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const lead = url.searchParams.get("lead") ?? "";
  const s = url.searchParams.get("s") ?? "";
  if (!UUID_RE.test(lead) || !s) {
    return jsonResponse({ error: "parâmetros inválidos" }, 400);
  }

  const sb = diagnosisServiceClient();
  const ip = publicClientIp(req);
  if (await publicRateLimitExceeded(sb, `lead-status:${ip}:${lead}`)) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
  }

  const { data } = await sb
    .from("ecommerce_leads")
    .select("id, status, access_slug, mp_payment_id, amount_cents, paid_at")
    .eq("id", lead)
    .maybeSingle();

  if (!data || data.access_slug !== s) {
    return jsonResponse({ error: "não encontrado" }, 404);
  }

  let status = data.status as string;
  if (status === "awaiting_payment" && data.mp_payment_id) {
    const reconciled = await reconcileLeadWithMp(
      sb,
      lead,
      String(data.mp_payment_id),
    );
    if (reconciled) status = reconciled;
  }

  trace.done({ lead_id: lead, status });
  return jsonResponse({
    status,
    amount_cents: data.amount_cents ?? null,
    paid_at: data.paid_at ?? null,
  });
});
