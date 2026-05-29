import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";

function siteUrl(): string {
  return (
    Deno.env.get("PUBLIC_SITE_URL") ??
    Deno.env.get("SITE_URL") ??
    ""
  ).replace(/\/+$/, "");
}

function priceReais(): number {
  const cents = parseInt(Deno.env.get("DIAGNOSIS_PRICE_CENTS") ?? "3700", 10);
  return Math.round(cents) / 100;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = publicClientIp(req);
  const sbRl = diagnosisServiceClient();
  if (await publicRateLimitExceeded(sbRl, `checkout:${ip}`)) {
    return jsonResponse({ error: "too_many_requests" }, 429);
  }

  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) {
    return jsonResponse(
      { error: "MERCADOPAGO_ACCESS_TOKEN não configurado" },
      500,
    );
  }
  const site = siteUrl();
  if (!site) {
    return jsonResponse({ error: "PUBLIC_SITE_URL não configurado" }, 500);
  }

  const sb = diagnosisServiceClient();
  const { data: row, error: insErr } = await sb
    .from("diagnoses")
    .insert({
      status: "awaiting_payment",
      amount_cents: Math.round(priceReais() * 100),
      currency: "BRL",
    })
    .select("id, secret_slug")
    .single();

  if (insErr || !row) {
    console.error(insErr);
    return jsonResponse({ error: "Falha ao criar diagnóstico" }, 500);
  }

  const diagnosisId = row.id as string;
  const secret = row.secret_slug as string;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

  const preference = {
    items: [
      {
        title: "Diagnóstico Meta Ads (e-commerce)",
        quantity: 1,
        currency_id: "BRL",
        unit_price: priceReais(),
      },
    ],
    external_reference: diagnosisId,
    notification_url: notificationUrl,
    back_urls: {
      success: `${site}/obrigado?d=${diagnosisId}&s=${secret}`,
      failure: `${site}/?checkout=falha`,
      pending: `${site}/obrigado?d=${diagnosisId}&s=${secret}`,
    },
    auto_return: "approved",
  };

  const mpRes = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    },
  );

  if (!mpRes.ok) {
    const t = await mpRes.text();
    console.error("MP preference error", mpRes.status, t);
    await sb.from("diagnoses").delete().eq("id", diagnosisId);
    return jsonResponse({ error: "Mercado Pago indisponível" }, 502);
  }

  const mpJson = (await mpRes.json()) as {
    id?: string;
    init_point?: string;
  };

  await sb
    .from("diagnoses")
    .update({ mp_preference_id: mpJson.id ?? null })
    .eq("id", diagnosisId);

  return jsonResponse({
    init_point: mpJson.init_point,
    diagnosis_id: diagnosisId,
    secret_slug: secret,
  });
});
