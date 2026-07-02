import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { aiBudgetExceeded } from "../_shared/ai-budget.ts";
import {
  assertOperator,
  getFunnelAgencyId,
  PROVISION_CHECKLIST_STEPS,
  publicSiteUrl,
} from "../_shared/management-provision-shared.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function budgetFromRange(range: string): number {
  switch (range) {
    case "<5k":
      return 3000;
    case "5k-15k":
      return 10000;
    case "15k-50k":
      return 30000;
    case ">50k":
      return 75000;
    default:
      return 0;
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "provision_lead_client");
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const leadId = String(body.lead_id ?? "").trim();
  const responsibleUserId = body.responsible_user_id
    ? String(body.responsible_user_id)
    : null;

  if (!UUID_RE.test(leadId)) {
    return jsonResponse({ error: "lead_id inválido" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const userId = userData.user.id;

  const funnelAgencyId = await getFunnelAgencyId(admin);
  if (!funnelAgencyId) {
    return jsonResponse({ error: "diagnosis_funnel_agency_id não configurado" }, 503);
  }

  const allowed = await assertOperator(admin, userId, funnelAgencyId);
  if (!allowed) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const { data: existingClient } = await admin
    .from("clients")
    .select("id, portal_slug")
    .eq("ecommerce_lead_id", leadId)
    .maybeSingle();
  if (existingClient) {
    return jsonResponse({
      ok: true,
      already_provisioned: true,
      client_id: existingClient.id,
      portal_slug: existingClient.portal_slug,
    });
  }

  const { data: lead, error: lErr } = await admin
    .from("ecommerce_leads")
    .select(
      "id, status, client_id, store_name, name, email, phone, website, challenge, monthly_ad_budget_range, amount_cents, utm_source, utm_campaign, utm_adset, utm_ad, access_slug",
    )
    .eq("id", leadId)
    .maybeSingle();

  if (lErr || !lead) {
    return jsonResponse({ error: "Lead não encontrado" }, 404);
  }
  if (lead.status !== "paid") {
    return jsonResponse({ error: "Lead ainda não está pago" }, 400);
  }
  if (lead.client_id) {
    return jsonResponse({ error: "Lead já provisionado" }, 400);
  }

  const mrrCents = (lead.amount_cents as number) ?? 499700;
  const clientName =
    (lead.store_name as string | null)?.trim() ||
    (lead.name as string | null)?.trim() ||
    "Cliente gestão";

  const { data: inserted, error: insErr } = await admin
    .from("clients")
    .insert({
      agency_id: funnelAgencyId,
      name: clientName,
      contact_email: (lead.email as string | null) ?? null,
      contact_phone: (lead.phone as string | null) ?? null,
      monthly_budget: budgetFromRange(String(lead.monthly_ad_budget_range ?? "")),
      mrr: mrrCents / 100,
      status: "onboarding",
      tags: ["origem:gestao-trafego", "gestao:4997"],
      ecommerce_lead_id: leadId,
      diagnosis_id: null,
      responsible_id: responsibleUserId ?? userId,
      started_at: new Date().toISOString().slice(0, 10),
    })
    .select("id, portal_slug")
    .single();

  if (insErr || !inserted) {
    console.error("provision lead client insert failed", insErr);
    return jsonResponse({ error: insErr?.message ?? "Falha ao criar cliente" }, 500);
  }

  const clientId = inserted.id as string;

  const checklistRows = PROVISION_CHECKLIST_STEPS.map((step) => ({
    agency_id: funnelAgencyId,
    client_id: clientId,
    step_key: step.key,
    title: step.title,
    status: "pending",
    sort_order: step.sort,
  }));
  await admin.from("onboarding_checklist_items").insert(checklistRows);

  const siteUrl = publicSiteUrl();
  const leadUrl = `${siteUrl}/gestao-trafego-obrigado?lead=${leadId}&s=${lead.access_slug}`;
  const noteLines = [
    "Origem: Funil /gestao-trafego (gestão R$ 4.997).",
    `Página obrigado: ${leadUrl}`,
    lead.website ? `Site/Instagram: ${lead.website}` : null,
    lead.challenge ? `Desafio: ${lead.challenge}` : null,
    lead.monthly_ad_budget_range
      ? `Investimento declarado: ${lead.monthly_ad_budget_range}`
      : null,
    lead.utm_source ? `UTM: ${lead.utm_source}` : null,
    lead.utm_campaign ? `Campanha: ${lead.utm_campaign}` : null,
  ].filter(Boolean);

  await admin.from("notes").insert({
    agency_id: funnelAgencyId,
    client_id: clientId,
    author_id: userId,
    content: noteLines.join("\n"),
  });

  const now = new Date().toISOString();
  await admin
    .from("ecommerce_leads")
    .update({
      client_id: clientId,
      provisioned_at: now,
      provisioned_by: userId,
      status: "converted",
    })
    .eq("id", leadId);

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    await fetch(`${supabaseUrl}/functions/v1/compute-health-scores`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...(cronSecret ? { "x-cron-secret": cronSecret } : {}),
      },
      body: JSON.stringify({ agency_id: funnelAgencyId, client_id: clientId }),
    });
  } catch (e) {
    console.warn("compute-health-scores invoke failed", e);
  }

  try {
    const budgetExceeded = await aiBudgetExceeded(admin, funnelAgencyId, 12000);
    if (!budgetExceeded) {
      const { error: jobErr } = await admin.from("ai_jobs").insert({
        agency_id: funnelAgencyId,
        client_id: clientId,
        job_type: "report",
        status: "pending",
        payload: {
          client_id: clientId,
          mode: "monthly_manager",
          click_context: "checkin_rotina",
          generated_by: userId,
          source: "lead_provision",
        },
        attempts: 0,
      });
      if (jobErr) console.warn("provision lead ai_jobs insert failed", jobErr);
    }
  } catch (e) {
    console.warn("provision lead enqueue report failed", e);
  }

  trace.done({ lead_id: leadId, client_id: clientId });
  return jsonResponse({
    ok: true,
    client_id: clientId,
    portal_slug: inserted.portal_slug,
  });
});
