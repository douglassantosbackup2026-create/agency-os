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
    description: managementItemTitle(),
    externalReference: `mgmt:${diagnosisId}`,
    notificationUrl,
    payer: {
      name: diag.payer_name as string,
      email: diag.payer_email as string,
      cpf: diag.payer_cpf as string,
    },
    method: method as "card" | "pix",
    card: cardInput,
    statementDescriptor: "GESTAO TRAFEGO",
  });

  const idemKey = `mgmt:${diagnosisId}:${method}`;
  const mpResult = await postMpPayment(idemKey, payload);

  if (!mpResult.ok) {
    console.error("MP management payment error", mpResult.res.status, mpResult.json);
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
    management_payment_method: method,
    management_mp_payment_id: mpId,
  };

  if (method === "pix") {
    const td = mpJson.point_of_interaction?.transaction_data;
    update.management_pix_qr_code = td?.qr_code ?? null;
    update.management_pix_qr_code_base64 = td?.qr_code_base64 ?? null;
    update.management_pix_expires_at = mpJson.date_of_expiration ?? null;
  }

  await sb.from("diagnoses").update(update).eq("id", diagnosisId);

  if (method === "card") {
    if (status === "approved") {
      await sb
        .from("diagnoses")
        .update({
          management_status: "paid",
          management_paid_at: new Date().toISOString(),
        })
        .eq("id", diagnosisId);
    }

    const redirect =
      status === "approved"
        ? `/gestao-obrigado?d=${diagnosisId}&s=${secret}`
        : null;

    trace.done({ status, diagnosis_id: diagnosisId });
    return jsonResponse({
      status,
      status_detail: mpJson.status_detail ?? null,
      redirect,
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
