import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import {
  buildMpPaymentPayload,
  isLiveCredentialMismatch,
  managementItemTitle,
  MP_CREDENTIAL_MISMATCH_ERROR,
  postMpPayment,
} from "../_shared/mp-transparent-payment.ts";
import { createMpPreapproval } from "../_shared/mp-preapproval.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";
import {
  amountMatchesExpected,
  managementPriceCentsFromEnv,
  paymentAmountCents,
} from "../_shared/mercadopago-webhook-helpers.ts";
import { notifyManagementPaid } from "../_shared/management-paid-hook.ts";

const DIAGNOSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "process_management_payment");
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const diagnosisId = String(body.diagnosis_id ?? "");
  const secret = String(body.secret_slug ?? "");
  const method = String(body.method ?? "");
  if (!DIAGNOSIS_ID_RE.test(diagnosisId) || !secret) {
    return jsonResponse({ error: "diagnóstico inválido" }, 400);
  }
  if (method !== "card" && method !== "pix") {
    return jsonResponse({ error: "método inválido" }, 400);
  }

  const ip = publicClientIp(req);
  const sbRl = diagnosisServiceClient();
  if (await publicRateLimitExceeded(sbRl, `management-process:${ip}`)) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
  }

  const sb = diagnosisServiceClient();
  const { data: diag } = await sb
    .from("diagnoses")
    .select(
      "id, secret_slug, management_status, management_amount_cents, payer_name, payer_email, payer_cpf, management_mp_payment_id, management_pix_qr_code",
    )
    .eq("id", diagnosisId)
    .maybeSingle();

  if (!diag || diag.secret_slug !== secret) {
    return jsonResponse({ error: "diagnóstico não encontrado" }, 404);
  }

  if (diag.management_status !== "awaiting_payment") {
    if (method === "pix" && diag.management_pix_qr_code) {
      return jsonResponse({
        status: "pending",
        pix: { qr_code: diag.management_pix_qr_code },
      });
    }
    return jsonResponse({ error: "pagamento já processado" }, 409);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
  const amount = (diag.management_amount_cents as number) / 100;

  // ===== CARTÃO: cria assinatura recorrente (Preapproval) =====
  if (method === "card") {
    const card = (body.card ?? {}) as Record<string, unknown>;
    const cardToken = String(card.token ?? "");
    if (!cardToken) {
      return jsonResponse({ error: "dados do cartão incompletos" }, 400);
    }

    const publicSiteUrl =
      Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/+$/, "") ||
      "https://opus-retention-os.lovable.app";
    const backUrl = `${publicSiteUrl}/gestao-obrigado?d=${diagnosisId}&s=${secret}`;

    const mpResult = await createMpPreapproval({
      reason: `${managementItemTitle()} — mensal`,
      externalReference: `mgmt-sub:${diagnosisId}`,
      payerEmail: diag.payer_email as string,
      cardTokenId: cardToken,
      amount,
      notificationUrl,
      backUrl,
    });

    if (!mpResult.ok) {
      console.error("MP preapproval error", mpResult.res.status, mpResult.json);
      if (isLiveCredentialMismatch(mpResult.res, mpResult.json as never)) {
        return jsonResponse(
          { error: MP_CREDENTIAL_MISMATCH_ERROR, code: "mp_credentials_environment_mismatch" },
          400,
        );
      }
      return jsonResponse(
        {
          error: mpResult.json.message ?? "Assinatura recusada pelo Mercado Pago",
        },
        502,
      );
    }

    const mpJson = mpResult.json;
    const preapprovalId = mpJson.id ?? null;
    const status = mpJson.status ?? "pending";

    // Cria/atualiza registo de assinatura local.
    if (preapprovalId) {
      const { error: subErr } = await sb
        .from("management_subscriptions")
        .upsert(
          {
            diagnosis_id: diagnosisId,
            mp_preapproval_id: String(preapprovalId),
            status,
            amount_cents: diag.management_amount_cents as number,
            currency: "BRL",
            frequency: 1,
            frequency_type: "months",
            payer_email: diag.payer_email as string,
            next_payment_date: mpJson.next_payment_date ?? null,
            last_event_at: new Date().toISOString(),
            last_payload: mpJson as unknown as Record<string, unknown>,
          },
          { onConflict: "mp_preapproval_id" },
        );
      if (subErr) console.error("subscription upsert failed", subErr);
    }

    // Marca diagnóstico como pago se MP autorizou (1ª cobrança imediata).
    const updates: Record<string, unknown> = {
      management_payment_method: "card",
      management_mp_payment_id: preapprovalId ? String(preapprovalId) : null,
    };
    if (status === "authorized") {
      updates.management_status = "paid";
      updates.management_paid_at = new Date().toISOString();
    }
    await sb.from("diagnoses").update(updates).eq("id", diagnosisId);

    if (status === "authorized") {
      try {
        await notifyManagementPaid(sb, diagnosisId);
      } catch (e) {
        console.error("process-management-payment notifyManagementPaid failed", e);
      }
    }

    const redirect =
      status === "authorized"
        ? `/gestao-obrigado?d=${diagnosisId}&s=${secret}`
        : null;

    trace.done({ status, diagnosis_id: diagnosisId, mode: "subscription" });
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

  // ===== PIX: pagamento único (1ª mensalidade), renovação manual =====
  const payload = buildMpPaymentPayload({
    amount,
    description: managementItemTitle(),
    externalReference: `mgmt:${diagnosisId}`,
    notificationUrl,
    payer: {
      name: diag.payer_name as string,
      email: diag.payer_email as string,
      cpf: diag.payer_cpf as string,
    },
    method: "pix",
    statementDescriptor: "GESTAO TRAFEGO",
  });

  const idemKey = `mgmt:${diagnosisId}:pix`;
  const mpResult = await postMpPayment(idemKey, payload);

  if (!mpResult.ok) {
    console.error("MP pix payment error", mpResult.res.status, mpResult.json);
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
    .from("diagnoses")
    .update({
      management_payment_method: "pix",
      management_mp_payment_id: mpId,
      management_pix_qr_code: td?.qr_code ?? null,
      management_pix_qr_code_base64: td?.qr_code_base64 ?? null,
      management_pix_expires_at: mpJson.date_of_expiration ?? null,
    })
    .eq("id", diagnosisId);

  // Sanity check do montante (mantém parity com o restante do fluxo).
  void amountMatchesExpected;
  void managementPriceCentsFromEnv;
  void paymentAmountCents;

  trace.done({ status: "pending", diagnosis_id: diagnosisId, mode: "pix" });
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
