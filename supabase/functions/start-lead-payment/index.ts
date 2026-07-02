import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { validatePayerInput } from "../_shared/mp-transparent-payment.ts";
import {
  assertLeadCheckoutReady,
  leadPriceCents,
  leadStartUpdateFields,
} from "../_shared/lead-checkout-shared.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "start_lead_payment");
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = publicClientIp(req);
  const sbRl = diagnosisServiceClient();
  if (await publicRateLimitExceeded(sbRl, `lead-start:${ip}`)) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
  }

  const publicKey = Deno.env.get("MERCADOPAGO_PUBLIC_KEY");
  if (!publicKey) {
    return jsonResponse({ error: "MERCADOPAGO_PUBLIC_KEY não configurado" }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const leadId = typeof body.lead_id === "string" ? body.lead_id : "";
  const accessSlug =
    typeof body.access_slug === "string" ? body.access_slug : "";

  const ready = await assertLeadCheckoutReady(leadId, accessSlug);
  if (!ready.ok) {
    return jsonResponse({ error: ready.message }, ready.status);
  }

  const payerResult = validatePayerInput(
    (body.payer ?? {}) as Record<string, unknown>,
  );
  if (!payerResult.ok) {
    return jsonResponse({ error: payerResult.error }, 400);
  }
  const payer = payerResult.payer;

  const sb = diagnosisServiceClient();
  const { error: upErr } = await sb
    .from("ecommerce_leads")
    .update({
      ...leadStartUpdateFields(),
      name: payer.name,
      email: payer.email,
      phone: payer.phone ?? null,
      payer_cpf: payer.cpf,
    })
    .eq("id", leadId);

  if (upErr) {
    console.error(upErr);
    return jsonResponse({ error: "Falha ao guardar dados" }, 500);
  }

  const cents = leadPriceCents();
  trace.done({ lead_id: leadId });
  return jsonResponse({
    lead_id: leadId,
    access_slug: accessSlug,
    amount_cents: cents,
    mp_public_key: publicKey,
  });
});
