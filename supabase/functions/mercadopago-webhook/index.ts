import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";

async function fetchPayment(
  paymentId: string,
  accessToken: string,
): Promise<Record<string, unknown> | null> {
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  return (await r.json()) as Record<string, unknown>;
}

Deno.serve(async (req) => {
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
    typeof body.data === "object" && body.data !== null &&
      typeof (body.data as { id?: string }).id === "string"
    ? (body.data as { id: string }).id
    : null;

  if (topic !== "payment" || !dataId) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
  const { data: existing } = await sb
    .from("diagnoses")
    .select("id, status, mp_payment_id")
    .eq("id", extRef)
    .maybeSingle();

  if (!existing) {
    return jsonResponse({ ok: true, note: "unknown diagnosis" }, 200);
  }

  if (existing.mp_payment_id === dataId) {
    return jsonResponse({ ok: true, idempotent: true }, 200);
  }

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

  return jsonResponse({ ok: true }, 200);
});
