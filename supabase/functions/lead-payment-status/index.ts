import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";
import { notifyLeadPaid } from "../_shared/lead-paid-hook.ts";
import { fetchMpPreapproval } from "../_shared/mp-preapproval.ts";

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

async function reconcileLeadPreapproval(
  sb: ReturnType<typeof diagnosisServiceClient>,
  leadId: string,
  preapprovalId: string,
): Promise<string | null> {
  try {
    const pre = await fetchMpPreapproval(preapprovalId);
    if (!pre || pre.status !== "authorized") return null;

    const paidAt = new Date().toISOString();
    const { error: upErr } = await sb
      .from("ecommerce_leads")
      .update({
        status: "paid",
        payment_method: "card",
        paid_at: paidAt,
      })
      .eq("id", leadId)
      .eq("status", "awaiting_payment");

    if (upErr) {
      console.error("lead-payment-status preapproval reconcile", upErr);
      return null;
    }

    try {
      await notifyLeadPaid(sb, leadId);
    } catch (e) {
      console.error("lead-payment-status notifyLeadPaid (preapproval) failed", e);
    }

    return "paid";
  } catch (e) {
    console.error("lead-payment-status: preapproval reconcile failed", e);
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
    .select(
      "id, status, access_slug, name, email, phone, payer_cpf, store_name, website, mp_payment_id, mp_preapproval_id, amount_cents, paid_at, payment_method, pix_qr_code, pix_qr_code_base64, pix_expires_at",
    )
    .eq("id", lead)
    .maybeSingle();

  if (!data || data.access_slug !== s) {
    return jsonResponse({ error: "não encontrado" }, 404);
  }

  let status = data.status as string;
  if (status === "awaiting_payment") {
    if (data.payment_method === "card" && data.mp_preapproval_id) {
      const reconciled = await reconcileLeadPreapproval(
        sb,
        lead,
        String(data.mp_preapproval_id),
      );
      if (reconciled) status = reconciled;
    } else if (data.mp_payment_id && data.payment_method !== "card") {
      const reconciled = await reconcileLeadWithMp(
        sb,
        lead,
        String(data.mp_payment_id),
      );
      if (reconciled) status = reconciled;
    }
  }

  let subscription: {
    status: string;
    next_payment_date: string | null;
    cancelled_at: string | null;
  } | null = null;
  const { data: sub } = await sb
    .from("management_subscriptions")
    .select("status, next_payment_date, cancelled_at")
    .eq("ecommerce_lead_id", lead)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sub) {
    subscription = {
      status: sub.status as string,
      next_payment_date: (sub.next_payment_date as string | null) ?? null,
      cancelled_at: (sub.cancelled_at as string | null) ?? null,
    };
  }

  const pix =
    status === "awaiting_payment" &&
    data.payment_method === "pix" &&
    data.pix_qr_code &&
    data.pix_qr_code_base64
      ? {
          qr_code: data.pix_qr_code as string,
          qr_code_base64: data.pix_qr_code_base64 as string,
          expires_at: (data.pix_expires_at as string | null) ?? null,
        }
      : null;

  trace.done({ lead_id: lead, status });
  return jsonResponse({
    status,
    amount_cents: data.amount_cents ?? null,
    paid_at: data.paid_at ?? null,
    payment_method: data.payment_method ?? null,
    lead: {
      name: data.name ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      payer_cpf: data.payer_cpf ?? null,
      store_name: data.store_name ?? null,
      website: data.website ?? null,
    },
    pix,
    subscription,
  });
});
