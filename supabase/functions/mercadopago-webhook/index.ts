import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import {
  ensureBuyerAccountAndToken,
  fetchBuyerDiagnosis,
} from "../_shared/diagnosis/buyer-account.ts";
import {
  amountMatchesExpected,
  managementPriceCentsFromEnv,
  paymentAmountCents,
} from "../_shared/mercadopago-webhook-helpers.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";

async function fetchPayment(
  paymentId: string,
  accessToken: string,
): Promise<Record<string, unknown> | null> {
  const r = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!r.ok) return null;
  return (await r.json()) as Record<string, unknown>;
}

const DIAGNOSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MGMT_PREFIX = "mgmt:";

// Verifica assinatura HMAC-SHA256 do Mercado Pago.
// Doc: header `x-signature: ts=...,v1=...` + `x-request-id`.
// Manifest assinado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
async function verifyMpSignature(
  req: Request,
  dataId: string,
  secret: string,
): Promise<boolean> {
  const sigHeader = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  if (!sigHeader || !requestId) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const tsMs = tsNum > 1e12 ? tsNum : tsNum * 1000;
  const maxSkewMs = 5 * 60 * 1000;
  if (Math.abs(Date.now() - tsMs) > maxSkewMs) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(manifest),
  );
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  const traceId = traceIdFromRequest(req);
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) return jsonResponse({ error: "MP token ausente" }, 500);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }


  const topic = typeof body.type === "string" ? body.type : "";
  const dataId =
    typeof body.data === "object" &&
    body.data !== null &&
    typeof (body.data as { id?: string }).id === "string"
      ? (body.data as { id: string }).id
      : null;

  if (topic !== "payment" || !dataId) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const webhookSecret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET")?.trim();
  if (!webhookSecret) {
    console.error(
      "mercadopago-webhook: MERCADOPAGO_WEBHOOK_SECRET ausente — recusado (fail-closed)",
    );
    return jsonResponse({ error: "webhook_not_configured" }, 503);
  }
  const sigOk = await verifyMpSignature(req, dataId, webhookSecret);
  if (!sigOk) {
    return jsonResponse({ error: "invalid signature" }, 401);
  }

  const payment = await fetchPayment(dataId, token);
  if (!payment) {
    return jsonResponse({ error: "payment fetch failed" }, 502);
  }

  const status = payment.status as string | undefined;
  const extRef = payment.external_reference as string | undefined;
  if (!extRef || typeof extRef !== "string") {
    return jsonResponse({ ok: true }, 200);
  }

  if (status !== "approved") {
    return jsonResponse({ ok: true, status }, 200);
  }

  const sb = diagnosisServiceClient();
  const idempotencyKey = `mp:payment:${dataId}`;

  const { data: priorEvent } = await sb
    .from("webhook_events")
    .select("idempotency_key")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (priorEvent) {
    traceLog("mercadopago_webhook.idempotent", { data_id: dataId }, traceId);
    return jsonResponse({ ok: true, idempotent: true }, 200);
  }

  async function claimIdempotency(): Promise<Response | null> {
    const { data: claimed, error: claimErr } = await sb
      .from("webhook_events")
      .insert({
        idempotency_key: idempotencyKey,
        branch: "payment",
        payload_hash: dataId,
      })
      .select("idempotency_key")
      .maybeSingle();

    if (claimErr) {
      const code = String((claimErr as { code?: string }).code ?? "");
      if (code === "23505") {
        traceLog("mercadopago_webhook.idempotent", { data_id: dataId }, traceId);
        return jsonResponse({ ok: true, idempotent: true }, 200);
      }
      console.error("webhook_events insert", claimErr);
      return jsonResponse({ error: "idempotency_failed" }, 500);
    }
    if (!claimed) {
      return jsonResponse({ ok: true, idempotent: true }, 200);
    }
    return null;
  }

  if (typeof extRef === "string" && extRef.startsWith(MGMT_PREFIX)) {
    const rawId = extRef.slice(MGMT_PREFIX.length);
    if (!DIAGNOSIS_ID_RE.test(rawId)) {
      return jsonResponse(
        { ok: true, note: "invalid mgmt external_reference" },
        200,
      );
    }
    const { data: existing } = await sb
      .from("diagnoses")
      .select("id, management_mp_payment_id, management_amount_cents")
      .eq("id", rawId)
      .maybeSingle();

    if (!existing) {
      return jsonResponse({ ok: true, note: "unknown diagnosis (mgmt)" }, 200);
    }

    const mgmtExpected =
      Number(existing.management_amount_cents) > 0
        ? Number(existing.management_amount_cents)
        : managementPriceCentsFromEnv();
    const mgmtPaid = paymentAmountCents(payment);
    if (!amountMatchesExpected(mgmtPaid, mgmtExpected)) {
      console.warn(
        JSON.stringify({
          evt: "mercadopago_webhook.amount_mismatch",
          branch: "mgmt",
          diagnosis_id: rawId,
          paid_cents: mgmtPaid,
          expected_cents: mgmtExpected,
        }),
      );
      return jsonResponse({ error: "amount mismatch" }, 400);
    }

    if (existing.management_mp_payment_id === dataId) {
      return jsonResponse({ ok: true, idempotent: true, branch: "mgmt" }, 200);
    }

    const claimResp = await claimIdempotency();
    if (claimResp) return claimResp;

    const paidAt = new Date().toISOString();
    const { error: upErr } = await sb
      .from("diagnoses")
      .update({
        management_mp_payment_id: dataId,
        management_status: "paid",
        management_paid_at: paidAt,
      })
      .eq("id", rawId);

    if (upErr) {
      console.error(upErr);
      return jsonResponse({ error: "db update failed (mgmt)" }, 500);
    }

    return jsonResponse({ ok: true, branch: "mgmt" }, 200);
  }

  if (!DIAGNOSIS_ID_RE.test(extRef)) {
    return jsonResponse(
      { ok: true, note: "invalid diagnosis external_reference" },
      200,
    );
  }

  const { data: existing } = await sb
    .from("diagnoses")
    .select("id, status, mp_payment_id, amount_cents")
    .eq("id", extRef)
    .maybeSingle();

  if (!existing) {
    return jsonResponse({ ok: true, note: "unknown diagnosis" }, 200);
  }

  const diagExpected = Number(existing.amount_cents);
  const diagPaid = paymentAmountCents(payment);
  if (!amountMatchesExpected(diagPaid, diagExpected)) {
    console.warn(
      JSON.stringify({
        evt: "mercadopago_webhook.amount_mismatch",
        branch: "diagnosis",
        diagnosis_id: extRef,
        paid_cents: diagPaid,
        expected_cents: diagExpected,
      }),
    );
    return jsonResponse({ error: "amount mismatch" }, 400);
  }

  if (existing.mp_payment_id === dataId) {
    return jsonResponse({ ok: true, idempotent: true }, 200);
  }

  const claimResp = await claimIdempotency();
  if (claimResp) return claimResp;

  const { error: upErr } = await sb
    .from("diagnoses")
    .update({
      mp_payment_id: dataId,
      status: "awaiting_connection",
    })
    .eq("id", extRef);

  if (upErr) {
    console.error(upErr);
    return jsonResponse({ error: "db update failed" }, 500);
  }

  // Provision buyer account + magiclink token (best-effort, never blocks ack).
  try {
    const diag = await fetchBuyerDiagnosis(sb, extRef);
    if (diag) await ensureBuyerAccountAndToken(sb, diag);
  } catch (e) {
    console.error("webhook: ensureBuyerAccountAndToken failed", e);
  }

  traceLog("mercadopago_webhook.ok", { data_id: dataId, ext_ref: extRef }, traceId);
  return jsonResponse({ ok: true }, 200);
});
