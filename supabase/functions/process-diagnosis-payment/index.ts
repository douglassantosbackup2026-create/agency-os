import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import {
  ensureBuyerAccountAndToken,
  fetchBuyerDiagnosis,
} from "../_shared/diagnosis/buyer-account.ts";

const DIAGNOSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface MpPaymentResponse {
  id?: number | string;
  status?: string;
  status_detail?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
  date_of_expiration?: string;
  message?: string;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return jsonResponse({ error: "MP token ausente" }, 500);

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
  const amount = (diag.amount_cents as number) / 100;

  const [firstName, ...rest] = (diag.payer_name as string).split(" ");
  const lastName = rest.join(" ") || firstName;

  const basePayload: Record<string, unknown> = {
    transaction_amount: amount,
    description: "Diagnóstico Meta Ads (e-commerce)",
    external_reference: diagnosisId,
    notification_url: notificationUrl,
    payer: {
      email: diag.payer_email,
      first_name: firstName,
      last_name: lastName,
      identification: { type: "CPF", number: diag.payer_cpf },
    },
  };

  let payload: Record<string, unknown>;

  if (method === "card") {
    const card = (body.card ?? {}) as Record<string, unknown>;
    const cardToken = String(card.token ?? "");
    const paymentMethodId = String(card.payment_method_id ?? "");
    const issuerId =
      card.issuer_id != null ? String(card.issuer_id) : undefined;
    const installments = Number(card.installments ?? 1);
    if (!cardToken || !paymentMethodId) {
      return jsonResponse({ error: "dados do cartão incompletos" }, 400);
    }
    payload = {
      ...basePayload,
      token: cardToken,
      payment_method_id: paymentMethodId,
      issuer_id: issuerId,
      installments,
      statement_descriptor: "DIAGNOSTICO META",
    };
  } else {
    const exp = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    payload = {
      ...basePayload,
      payment_method_id: "pix",
      date_of_expiration: exp.replace("Z", "-03:00"),
    };
  }

  const idemKey = `${diagnosisId}:${method}`;
  const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idemKey,
    },
    body: JSON.stringify(payload),
  });

  const mpJson = (await mpRes.json()) as MpPaymentResponse;

  if (!mpRes.ok) {
    console.error("MP payment error", mpRes.status, mpJson);
    return jsonResponse(
      {
        error: mpJson.message ?? "Pagamento recusado pelo Mercado Pago",
        status_detail: mpJson.status_detail,
      },
      502,
    );
  }

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
      // also flip status so /obrigado polling sees approved
      await sb
        .from("diagnoses")
        .update({ status: "awaiting_connection" })
        .eq("id", diagnosisId);
      try {
        const diag = await fetchBuyerDiagnosis(sb, diagnosisId);
        if (diag) {
          const r = await ensureBuyerAccountAndToken(sb, diag);
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

    return jsonResponse({
      status,
      status_detail: mpJson.status_detail ?? null,
      redirect,
      auto_login_token: autoLoginToken,
    });
  }

  const td = mpJson.point_of_interaction?.transaction_data;
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
