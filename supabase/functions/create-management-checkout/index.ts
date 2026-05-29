import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertDiagnosisSecret } from "../_shared/diagnosis/validate-diagnosis-access.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { isManagementCtaEligible } from "../_shared/diagnosis/management-eligibility.ts";
import { publicClientIp } from "../_shared/public-rate-limit.ts";
import { distributedRateLimitExceeded } from "../_shared/distributed-rate-limit.ts";

function siteUrl(): string {
  return (
    Deno.env.get("PUBLIC_SITE_URL") ??
    Deno.env.get("SITE_URL") ??
    ""
  ).replace(/\/+$/, "");
}

function trimStr(v: unknown, max: number): string | null {
  if (v === undefined || v === null) return null;
  const t = typeof v === "string" ? v.trim() : String(v).trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function managementPriceCents(): number {
  const n = parseInt(Deno.env.get("MANAGEMENT_PRICE_CENTS") ?? "199700", 10);
  return Number.isFinite(n) && n > 0 ? n : 199700;
}

function managementItemTitle(): string {
  const t = Deno.env.get("MANAGEMENT_MP_ITEM_TITLE")?.trim();
  return t || "Gestão de tráfego Meta / Google";
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = publicClientIp(req);
  const sbRl = diagnosisServiceClient();
  const maxPerWindow = Math.max(
    1,
    Number(Deno.env.get("PUBLIC_RATE_LIMIT_MAX_PER_WINDOW") ?? "30") || 30,
  );
  const windowSec = Math.max(
    1,
    Math.floor(
      (Number(Deno.env.get("PUBLIC_RATE_LIMIT_WINDOW_MS") ?? "60000") ||
        60000) / 1000,
    ),
  );
  if (
    await distributedRateLimitExceeded(
      sbRl,
      `management-checkout:${ip}`,
      maxPerWindow,
      windowSec,
    )
  ) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
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

  const gate = await assertDiagnosisSecret(diagnosisId, secretSlug);
  if (!gate.ok) return jsonResponse({ error: gate.message }, gate.status);

  const businessName = trimStr(body.business_name, 240);
  const website = trimStr(body.website, 500);
  const instagram = trimStr(body.instagram, 240);
  if (!businessName || !website || !instagram) {
    return jsonResponse(
      { error: "Nome da loja, site e Instagram são obrigatórios" },
      400,
    );
  }

  const sb = diagnosisServiceClient();
  const { data: diag, error: dErr } = await sb
    .from("diagnoses")
    .select("id, secret_slug, status, management_status")
    .eq("id", diagnosisId)
    .maybeSingle();

  if (dErr || !diag) {
    console.error(dErr);
    return jsonResponse({ error: "Diagnóstico não encontrado" }, 404);
  }

  if ((diag.status as string) !== "completed") {
    return jsonResponse({ error: "Diagnóstico ainda não concluído" }, 403);
  }

  if ((diag.management_status as string | null) === "paid") {
    return jsonResponse({ error: "Gestão já paga neste diagnóstico" }, 400);
  }

  const { data: rep } = await sb
    .from("diagnosis_reports")
    .select("facts_json")
    .eq("diagnosis_id", diagnosisId)
    .maybeSingle();

  if (!isManagementCtaEligible(rep?.facts_json)) {
    return jsonResponse({ error: "Conta não elegível para gestão" }, 403);
  }

  const cents = managementPriceCents();
  const unitPrice = cents / 100;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
  const sec = diag.secret_slug as string;
  const qp = `d=${encodeURIComponent(diagnosisId)}&s=${encodeURIComponent(sec)}`;
  const reportBack = `${site}/diagnostico/${encodeURIComponent(diagnosisId)}?s=${encodeURIComponent(sec)}`;

  const preference = {
    items: [
      {
        title: managementItemTitle(),
        quantity: 1,
        currency_id: "BRL",
        unit_price: unitPrice,
      },
    ],
    external_reference: `mgmt:${diagnosisId}`,
    notification_url: notificationUrl,
    back_urls: {
      success: `${site}/gestao-obrigado?${qp}`,
      failure: `${reportBack}&gestaoCheckout=falha`,
      pending: `${reportBack}&gestaoCheckout=pending`,
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
    return jsonResponse({ error: "Mercado Pago indisponível" }, 502);
  }

  const mpJson = (await mpRes.json()) as {
    id?: string;
    init_point?: string;
  };

  const { error: upErr } = await sb
    .from("diagnoses")
    .update({
      management_business_name: businessName,
      management_website: website,
      management_instagram: instagram,
      management_status: "awaiting_payment",
      management_mp_preference_id: mpJson.id ?? null,
      management_amount_cents: cents,
    })
    .eq("id", diagnosisId);

  if (upErr) {
    console.error(upErr);
    return jsonResponse({ error: "Falha ao guardar dados" }, 500);
  }

  return jsonResponse({
    init_point: mpJson.init_point,
    diagnosis_id: diagnosisId,
  });
});
