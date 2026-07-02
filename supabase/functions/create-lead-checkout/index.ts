import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function siteUrl(): string {
  return (
    Deno.env.get("PUBLIC_SITE_URL") ??
    Deno.env.get("SITE_URL") ??
    ""
  ).replace(/\/+$/, "");
}

function leadPriceCents(): number {
  const n = parseInt(
    Deno.env.get("LEAD_MANAGEMENT_PRICE_CENTS") ??
      Deno.env.get("MANAGEMENT_PRICE_CENTS") ??
      "499700",
    10,
  );
  return Number.isFinite(n) && n > 0 ? n : 499700;
}

function itemTitle(): string {
  const t = Deno.env.get("MANAGEMENT_MP_ITEM_TITLE")?.trim();
  return t || "Gestão de Tráfego Meta Ads — 3 vagas/mês";
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "create_lead_checkout");
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = publicClientIp(req);
  const sbRl = diagnosisServiceClient();
  if (await publicRateLimitExceeded(sbRl, `lead-checkout:${ip}`)) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
  }

  const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
  if (!token) {
    return jsonResponse({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado" }, 500);
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

  const leadId = typeof body.lead_id === "string" ? body.lead_id.trim() : "";
  const accessSlug =
    typeof body.access_slug === "string" ? body.access_slug.trim() : "";
  if (!UUID_RE.test(leadId)) {
    return jsonResponse({ error: "lead_id inválido" }, 400);
  }
  if (!accessSlug) {
    return jsonResponse({ error: "access_slug obrigatório" }, 400);
  }

  const sb = diagnosisServiceClient();
  const { data: lead, error: lErr } = await sb
    .from("ecommerce_leads")
    .select("id, name, email, phone, status, access_slug")
    .eq("id", leadId)
    .maybeSingle();

  if (lErr || !lead) {
    return jsonResponse({ error: "Lead não encontrado" }, 404);
  }
  if ((lead.access_slug as string) !== accessSlug) {
    return jsonResponse({ error: "Lead não encontrado" }, 404);
  }
  if ((lead.status as string) === "paid") {
    return jsonResponse({ error: "Pagamento já confirmado para este lead" }, 400);
  }

  const cents = leadPriceCents();
  const unitPrice = cents / 100;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const notificationUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
  const qp = `lead=${encodeURIComponent(leadId)}&s=${encodeURIComponent(accessSlug)}`;

  const preference = {
    items: [
      {
        title: itemTitle(),
        quantity: 1,
        currency_id: "BRL",
        unit_price: unitPrice,
      },
    ],
    payer: lead.email
      ? {
          name: (lead.name as string | null) ?? undefined,
          email: lead.email as string,
        }
      : undefined,
    external_reference: `lead:${leadId}`,
    notification_url: notificationUrl,
    back_urls: {
      success: `${site}/gestao-obrigado-lead?${qp}`,
      failure: `${site}/gestao-trafego-obrigado?${qp}&checkout=falha`,
      pending: `${site}/gestao-trafego-obrigado?${qp}&checkout=pending`,
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

  const mpJson = (await mpRes.json()) as { id?: string; init_point?: string };

  const { error: upErr } = await sb
    .from("ecommerce_leads")
    .update({
      status: "awaiting_payment",
      mp_preference_id: mpJson.id ?? null,
      amount_cents: cents,
    })
    .eq("id", leadId);

  if (upErr) {
    console.error(upErr);
    return jsonResponse({ error: "Falha ao guardar dados" }, 500);
  }

  trace.done({ lead_id: leadId });
  return jsonResponse({
    init_point: mpJson.init_point,
    lead_id: leadId,
  });
});
