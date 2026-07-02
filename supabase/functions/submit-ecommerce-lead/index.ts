import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";

const BUDGET_RANGES = new Set(["<5k", "5k-15k", "15k-50k", ">50k"]);

function generateAccessSlug(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "submit_ecommerce_lead");
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const ip = publicClientIp(req);
  const sb = diagnosisServiceClient();
  if (await publicRateLimitExceeded(sb, `lead-submit:${ip}`)) {
    return jsonResponse({ error: "Muitas tentativas. Aguarde um momento." }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const storeName = typeof body.store_name === "string" ? body.store_name.trim() : "";
  const website = typeof body.website === "string" ? body.website.trim() : "";
  const monthlyAdBudgetRange =
    typeof body.monthly_ad_budget_range === "string"
      ? body.monthly_ad_budget_range.trim()
      : "";
  const challenge =
    typeof body.challenge === "string" ? body.challenge.trim().slice(0, 1000) : null;
  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 100)
      : "meta_ads";
  const utmSource =
    typeof body.utm_source === "string" ? body.utm_source.trim().slice(0, 200) : null;
  const utmCampaign =
    typeof body.utm_campaign === "string" ? body.utm_campaign.trim().slice(0, 200) : null;
  const utmAdset =
    typeof body.utm_adset === "string" ? body.utm_adset.trim().slice(0, 200) : null;
  const utmAd =
    typeof body.utm_ad === "string" ? body.utm_ad.trim().slice(0, 200) : null;

  if (name.length < 2 || email.length < 5 || !email.includes("@") || phone.length < 8) {
    return jsonResponse({ error: "Dados inválidos" }, 400);
  }
  if (storeName.length < 2 || website.length < 2) {
    return jsonResponse({ error: "Dados da loja inválidos" }, 400);
  }
  if (!BUDGET_RANGES.has(monthlyAdBudgetRange)) {
    return jsonResponse({ error: "Faixa de investimento inválida" }, 400);
  }

  const leadId = crypto.randomUUID();
  const accessSlug = generateAccessSlug();

  const { error } = await sb.from("ecommerce_leads").insert({
    id: leadId,
    access_slug: accessSlug,
    name,
    email,
    phone,
    store_name: storeName,
    website,
    monthly_ad_budget_range: monthlyAdBudgetRange,
    challenge,
    source,
    utm_source: utmSource,
    utm_campaign: utmCampaign,
    utm_adset: utmAdset,
    utm_ad: utmAd,
    status: "new",
  });

  if (error) {
    console.error("submit_ecommerce_lead insert", error);
    return jsonResponse({ error: "Falha ao salvar lead" }, 500);
  }

  trace.done({ lead_id: leadId });
  return jsonResponse({
    lead_id: leadId,
    access_slug: accessSlug,
  });
});
