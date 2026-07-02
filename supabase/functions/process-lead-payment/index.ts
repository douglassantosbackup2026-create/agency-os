import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import {
  buildMpPaymentPayload,
  isLiveCredentialMismatch,
  MP_CREDENTIAL_MISMATCH_ERROR,
  postMpPayment,
} from "../_shared/mp-transparent-payment.ts";
import { createMpPreapproval } from "../_shared/mp-preapproval.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";
import {
  assertLeadCheckoutReady,
  leadItemTitle,
  leadPriceCents,
} from "../_shared/lead-checkout-shared.ts";
import { notifyLeadPaid } from "../_shared/lead-paid-hook.ts";
import {
  assertLeadSlotAvailable,
  LEAD_SLOTS_FULL_MESSAGE,
  markLeadPaidIfSlotAvailable,
} from "../_shared/lead-slots-shared.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "process_lead_payment");
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const leadId = String(body.lead_id ?? "");
  const accessSlug = String(body.access_slug ?? "");
  const method = String(body.method ?? "");
  if (!UUID_RE.test(leadId) || !accessSlug) {
    return jsonResponse({ error: "lead inválido" }, 400);
  }
  if (method !== "card" && method !== "pix") {
    return jsonResponse({ error: "método inválido" }, 400);
  }

  const ip = publicClientIp(req);
  const sbRl = diagnosisServiceClient();
  if (await publicRateLimitExceeded(sbRl, `lead-process:${ip}`)) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
  }

  const ready = await assertLeadCheckoutReady(leadId, accessSlug);
  if (!ready.ok) {
    return jsonResponse({ error: ready.message }, ready.status);
  }

  const sb = diagnosisServiceClient();
  const { data: lead } = await sb
    .from("ecommerce_leads")
    .select(
      "id, status, access_slug, amount_cents, name, email, payer_cpf, phone, mp_payment_id, pix_qr_code, pix_qr_code_base64",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (!lead || lead.access_slug !== accessSlug) {
    return jsonResponse({ error: "lead não encontrado" }, 404);
  }

  if ((lead.status as string) === "paid") {
    return jsonResponse({ error: "pagamento já processado" }, 409);
  }

  if ((lead.status as string) !== "awaiting_payment") {
    return jsonResponse({ error: "inicie o pagamento antes de processar" }, 409);
  }

  const slotCheck = await assertLeadSlotAvailable(sb, leadId);
  if (!slotCheck.ok) {
    if (slotCheck.reason === "slots_full") {
      return jsonResponse(
        { error: LEAD_SLOTS_FULL_MESSAGE, code: "lead_slots_full" },
        409,
      );
    }
    return jsonResponse({ error: "lead não encontrado" }, 404);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
  const cents =
    Number(lead.amount_cents) > 0 ? Number(lead.amount_cents) : leadPriceCents();
  const amount = cents / 100;
  const publicSiteUrl =
    Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/+$/, "") ||
    "https://agencyopus.live";
  const backQp = `lead=${encodeURIComponent(leadId)}&s=${encodeURIComponent(accessSlug)}`;

  if (method === "card") {
    const card = (body.card ?? {}) as Record<string, unknown>;
    const cardToken = String(card.token ?? "");
    if (!cardToken) {
      return jsonResponse({ error: "dados do cartão incompletos" }, 400);
    }

    const mpResult = await createMpPreapproval({
      reason: `${leadItemTitle()} — mensal`,
      externalReference: `lead-sub:${leadId}`,
      payerEmail: lead.email as string,
      cardTokenId: cardToken,
      amount,
      notificationUrl,
      backUrl: `${publicSiteUrl}/gestao-obrigado-lead?${backQp}`,
    });

    if (!mpResult.ok) {
      console.error("MP preapproval error (lead)", mpResult.res.status, mpResult.json);
      if (isLiveCredentialMismatch(mpResult.res, mpResult.json as never)) {
        return jsonResponse(
          { error: MP_CREDENTIAL_MISMATCH_ERROR, code: "mp_credentials_environment_mismatch" },
          400,
        );
      }
      return jsonResponse(
        { error: mpResult.json.message ?? "Assinatura recusada pelo Mercado Pago" },
        502,
      );
    }

    const mpJson = mpResult.json;
    const preapprovalId = mpJson.id ?? null;
    const status = mpJson.status ?? "pending";

    if (preapprovalId) {
      const { error: subErr } = await sb
        .from("management_subscriptions")
        .upsert(
          {
            ecommerce_lead_id: leadId,
            diagnosis_id: null,
            mp_preapproval_id: String(preapprovalId),
            status,
            amount_cents: cents,
            currency: "BRL",
            frequency: 1,
            frequency_type: "months",
            payer_email: lead.email as string,
            next_payment_date: mpJson.next_payment_date ?? null,
            last_event_at: new Date().toISOString(),
            last_payload: mpJson as unknown as Record<string, unknown>,
          },
          { onConflict: "mp_preapproval_id" },
        );
      if (subErr) console.error("lead subscription upsert failed", subErr);
    }

    if (status !== "authorized") {
      await sb
        .from("ecommerce_leads")
        .update({
          payment_method: "card",
          mp_preapproval_id: preapprovalId ? String(preapprovalId) : null,
        })
        .eq("id", leadId);
    } else {
      const mark = await markLeadPaidIfSlotAvailable(sb, leadId, {
        payment_method: "card",
        mp_preapproval_id: preapprovalId ? String(preapprovalId) : null,
      });
      if (!mark.ok) {
        if (mark.reason === "slots_full") {
          return jsonResponse(
            { error: LEAD_SLOTS_FULL_MESSAGE, code: "lead_slots_full" },
            409,
          );
        }
        return jsonResponse({ error: "Falha ao confirmar pagamento" }, 500);
      }
      try {
        await notifyLeadPaid(sb, leadId);
      } catch (e) {
        console.error("process-lead-payment notifyLeadPaid failed", e);
      }
    }

    const redirect =
      status === "authorized"
        ? `/gestao-obrigado-lead?${backQp}`
        : null;

    trace.done({ status, lead_id: leadId, mode: "subscription" });
    return jsonResponse({
      status: status === "authorized" ? "approved" : status,
      subscription: {
        id: preapprovalId,
        status,
        next_payment_date: mpJson.next_payment_date ?? null,
      },
      redirect,
    });
  }

  if (lead.pix_qr_code && lead.pix_qr_code_base64) {
    return jsonResponse({
      status: "pending",
      pix: {
        qr_code: lead.pix_qr_code,
        qr_code_base64: lead.pix_qr_code_base64,
      },
    });
  }

  const payerCpf = String(lead.payer_cpf ?? "");
  if (!payerCpf) {
    return jsonResponse({ error: "CPF do pagador ausente" }, 400);
  }

  const payload = buildMpPaymentPayload({
    amount,
    description: leadItemTitle(),
    externalReference: `lead:${leadId}`,
    notificationUrl,
    payer: {
      name: lead.name as string,
      email: lead.email as string,
      cpf: payerCpf,
      phone: (lead.phone as string | null) ?? undefined,
    },
    method: "pix",
    statementDescriptor: "GESTAO TRAFEGO",
  });

  const idemKey = `lead:${leadId}:pix`;
  const mpResult = await postMpPayment(idemKey, payload);

  if (!mpResult.ok) {
    console.error("MP pix payment error (lead)", mpResult.res.status, mpResult.json);
    if (isLiveCredentialMismatch(mpResult.res, mpResult.json)) {
      return jsonResponse(
        { error: MP_CREDENTIAL_MISMATCH_ERROR, code: "mp_credentials_environment_mismatch" },
        400,
      );
    }
    return jsonResponse(
      {
        error: mpResult.json.message ?? "Pagamento recusado pelo Mercado Pago",
        status_detail: mpResult.json.status_detail,
      },
      502,
    );
  }

  const mpJson = mpResult.json;
  const mpId = mpJson.id != null ? String(mpJson.id) : null;
  const td = mpJson.point_of_interaction?.transaction_data;

  await sb
    .from("ecommerce_leads")
    .update({
      payment_method: "pix",
      mp_payment_id: mpId,
      pix_qr_code: td?.qr_code ?? null,
      pix_qr_code_base64: td?.qr_code_base64 ?? null,
      pix_expires_at: mpJson.date_of_expiration ?? null,
    })
    .eq("id", leadId);

  trace.done({ status: "pending", lead_id: leadId, mode: "pix" });
  return jsonResponse({
    status: "pending",
    pix: {
      qr_code: td?.qr_code ?? null,
      qr_code_base64: td?.qr_code_base64 ?? null,
      ticket_url: td?.ticket_url ?? null,
      expires_at: mpJson.date_of_expiration ?? null,
    },
  });
});
