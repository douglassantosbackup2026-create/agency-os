import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertNoConflictingOpenPaidDiagnosis } from "../_shared/diagnosis/buyer-diagnosis-eligibility.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import {
  ensureBuyerAccountAndToken,
  fetchBuyerDiagnosis,
} from "../_shared/diagnosis/buyer-account.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import {
  buildMpPaymentPayload,
  isLiveCredentialMismatch,
  MP_CREDENTIAL_MISMATCH_ERROR,
  postMpPayment,
} from "../_shared/mp-transparent-payment.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";
import {
  amountMatchesExpected,
  paymentAmountCents,
} from "../_shared/mercadopago-webhook-helpers.ts";

const DIAGNOSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "process_diagnosis_payment");
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

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
  if (await publicRateLimitExceeded(sbRl, `diagnosis-process:${ip}`)) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
  }

  const sb = diagnosisServiceClient();
  const { data: diag } = await sb
    .from("diagnoses")
    .select(
      "id, secret_slug, status, amount_cents, payer_name, payer_email, payer_cpf, payer_phone, mp_payment_id, pix_qr_code",
    )
    .eq("id", diagnosisId)
    .maybeSingle();

  if (!diag || diag.secret_slug !== secret) {
    return jsonResponse({ error: "diagnóstico não encontrado" }, 404);
  }

  if (diag.status !== "awaiting_payment") {
    if (method === "pix" && diag.pix_qr_code) {
      return jsonResponse({
        status: "pending",
        pix: {
          qr_code: diag.pix_qr_code,
        },
      });
    }
    return jsonResponse({ error: "pagamento já processado" }, 409);
  }

  const payerEmail = typeof diag.payer_email === "string" ? diag.payer_email : "";
  if (payerEmail) {
    const conflict = await assertNoConflictingOpenPaidDiagnosis(
      sb,
      payerEmail,
      diagnosisId,
    );
    if (conflict) {
      return jsonResponse(conflict, 409);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
  const amount = (diag.amount_cents as number) / 100;

  let cardInput;
  if (method === "card") {
    const card = (body.card ?? {}) as Record<string, unknown>;
    const cardToken = String(card.token ?? "");
    const paymentMethodId = String(card.payment_method_id ?? "");
    if (!cardToken || !paymentMethodId) {
      return jsonResponse({ error: "dados do cartão incompletos" }, 400);
    }
    cardInput = {
      token: cardToken,
      payment_method_id: paymentMethodId,
      issuer_id: card.issuer_id != null ? String(card.issuer_id) : undefined,
      installments: Number(card.installments ?? 1),
    };
  }

  const payload = buildMpPaymentPayload({
    amount,
    description: "Diagnóstico Meta Ads (e-commerce)",
    externalReference: diagnosisId,
    notificationUrl,
    payer: {
      name: diag.payer_name as string,
      email: diag.payer_email as string,
      cpf: diag.payer_cpf as string,
      phone: diag.payer_phone as string | undefined,
    },
    method: method as "card" | "pix",
    card: cardInput,
    statementDescriptor: "DIAGNOSTICO META",
  });

  const idemKey = `${diagnosisId}:${method}`;
  const mpResult = await postMpPayment(idemKey, payload);

  if (!mpResult.ok) {
    console.error("MP payment error", mpResult.res.status, mpResult.json);
    if (isLiveCredentialMismatch(mpResult.res, mpResult.json)) {
      return jsonResponse(
        {
          error: MP_CREDENTIAL_MISMATCH_ERROR,
          code: "mp_credentials_environment_mismatch",
        },
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
  const status = mpJson.status ?? "unknown";

  const update: Record<string, unknown> = {
    payment_method: method,
    mp_payment_id: mpId,
  };

  if (method === "pix") {
    const td = mpJson.point_of_interaction?.transaction_data;
    update.pix_qr_code = td?.qr_code ?? null;
    update.pix_qr_code_base64 = td?.qr_code_base64 ?? null;
    update.pix_expires_at = mpJson.date_of_expiration ?? null;
  }

  await sb.from("diagnoses").update(update).eq("id", diagnosisId);

  if (method === "card") {
    let autoLoginToken: string | null = null;
    if (status === "approved") {
      const paidCents = paymentAmountCents(mpJson as Record<string, unknown>);
      if (!amountMatchesExpected(paidCents, diag.amount_cents as number)) {
        return jsonResponse({ error: "amount mismatch" }, 400);
      }
      await sb
        .from("diagnoses")
        .update({ status: "awaiting_connection" })
        .eq("id", diagnosisId);
      try {
        const buyer = await fetchBuyerDiagnosis(sb, diagnosisId);
        if (buyer) {
          const r = await ensureBuyerAccountAndToken(sb, buyer);
          autoLoginToken = r.auto_login_token;
        }
      } catch (e) {
        console.error("process-payment: buyer account failed", e);
      }
    }

    const redirect =
      status === "approved"
        ? `/obrigado?d=${diagnosisId}&s=${secret}${autoLoginToken ? `&t=${encodeURIComponent(autoLoginToken)}` : ""}`
        : null;

    trace.done({ status, diagnosis_id: diagnosisId });
    return jsonResponse({
      status,
      status_detail: mpJson.status_detail ?? null,
      redirect,
      auto_login_token: autoLoginToken,
    });
  }

  const td = mpJson.point_of_interaction?.transaction_data;
  trace.done({ status: "pending", diagnosis_id: diagnosisId });
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
