import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { validatePayerInput } from "../_shared/mp-transparent-payment.ts";
import {
  assertManagementCheckoutReady,
  managementStartUpdateFields,
  trimStr,
} from "../_shared/management-checkout-shared.ts";
import { managementPriceCents } from "../_shared/mp-transparent-payment.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "start_management_payment");
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = publicClientIp(req);
  const sbRl = diagnosisServiceClient();
  if (await publicRateLimitExceeded(sbRl, `management-start:${ip}`)) {
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

  const diagnosisId =
    typeof body.diagnosis_id === "string" ? body.diagnosis_id : "";
  const secretSlug =
    typeof body.secret_slug === "string" ? body.secret_slug : "";

  const businessName = trimStr(body.business_name, 240);
  const website = trimStr(body.website, 500);
  const instagram = trimStr(body.instagram, 240);

  const ready = await assertManagementCheckoutReady(
    diagnosisId,
    secretSlug,
    businessName,
    website,
    instagram,
  );
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
    .from("diagnoses")
    .update({
      ...managementStartUpdateFields(
        businessName!,
        website!,
        instagram!,
      ),
      payer_name: payer.name,
      payer_email: payer.email,
      payer_cpf: payer.cpf,
      payer_phone: payer.phone ?? null,
    })
    .eq("id", diagnosisId);

  if (upErr) {
    console.error(upErr);
    return jsonResponse({ error: "Falha ao guardar dados" }, 500);
  }

  const cents = managementPriceCents();
  trace.done({ diagnosis_id: diagnosisId });
  return jsonResponse({
    diagnosis_id: diagnosisId,
    secret_slug: secretSlug,
    amount_cents: cents,
    mp_public_key: publicKey,
  });
});
