import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { actionCenterRowsFromPlan } from "../_shared/management-action-plan.ts";
import { aiBudgetExceeded } from "../_shared/ai-budget.ts";

const DIAGNOSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CHECKLIST_STEPS: { key: string; title: string; sort: number }[] = [
  { key: "platform_access", title: "Solicitar acessos às plataformas", sort: 0 },
  { key: "budget_goal", title: "Configurar budget e meta do cliente", sort: 1 },
  { key: "portal_sent", title: "Enviar link do portal ao cliente", sort: 2 },
  { key: "first_report", title: "Gerar primeiro relatório IA", sort: 3 },
  { key: "diagnostic_run", title: "Diagnóstico inicial de saúde da carteira", sort: 4 },
];

async function getFunnelAgencyId(
  admin: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data } = await admin
    .from("retentio_ops_config")
    .select("diagnosis_funnel_agency_id")
    .eq("id", 1)
    .maybeSingle();
  return (data as { diagnosis_funnel_agency_id?: string | null } | null)
    ?.diagnosis_funnel_agency_id ?? null;
}

async function assertOperator(
  admin: ReturnType<typeof createClient>,
  userId: string,
  agencyId: string,
): Promise<boolean> {
  const { data: profile } = await admin
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.is_platform_admin) return true;

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("agency_id", agencyId);
  return (roles ?? []).some((r) => r.role === "owner" || r.role === "admin");
}

function parseSpendFromFacts(facts: unknown): number {
  if (!facts || typeof facts !== "object") return 0;
  const ins = (facts as Record<string, unknown>).account_insights;
  if (!ins || typeof ins !== "object") return 0;
  const raw = (ins as Record<string, unknown>).spend;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? "0"));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "provision_management_client");
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

  const diagnosisId = String(body.diagnosis_id ?? "").trim();
  const responsibleUserId = body.responsible_user_id
    ? String(body.responsible_user_id)
    : null;

  if (!DIAGNOSIS_ID_RE.test(diagnosisId)) {
    return jsonResponse({ error: "diagnosis_id inválido" }, 400);
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
    .eq("diagnosis_id", diagnosisId)
    .maybeSingle();
  if (existingClient) {
    return jsonResponse({
      ok: true,
      already_provisioned: true,
      client_id: existingClient.id,
      portal_slug: existingClient.portal_slug,
    });
  }

  const { data: diag, error: dErr } = await admin
    .from("diagnoses")
    .select(
      "id, secret_slug, management_status, management_amount_cents, management_business_name, management_website, management_instagram, management_payment_method, payer_name, payer_email, payer_phone, meta_ad_account_id",
    )
    .eq("id", diagnosisId)
    .maybeSingle();

  if (dErr || !diag) {
    return jsonResponse({ error: "Diagnóstico não encontrado" }, 404);
  }
  if (diag.management_status !== "paid") {
    return jsonResponse({ error: "Gestão ainda não paga" }, 400);
  }

  const { data: submission } = await admin
    .from("management_onboarding_submissions")
    .select("monthly_ad_budget, roas_goal, access_notes")
    .eq("diagnosis_id", diagnosisId)
    .maybeSingle();

  const { data: report } = await admin
    .from("diagnosis_reports")
    .select("facts_json, analysis_json")
    .eq("diagnosis_id", diagnosisId)
    .maybeSingle();

  const facts = (report?.facts_json ?? null) as Record<string, unknown> | null;
  const analysis = (report?.analysis_json ?? null) as Record<string, unknown> | null;
  const spendFromFacts = parseSpendFromFacts(facts);
  const budgetFromForm = submission?.monthly_ad_budget
    ? Number(submission.monthly_ad_budget)
    : 0;
  const mrrCents = (diag.management_amount_cents as number) ?? 199700;

  const clientName =
    (diag.management_business_name as string | null)?.trim() ||
    (diag.payer_name as string | null)?.trim() ||
    "Cliente gestão";

  const { data: inserted, error: insErr } = await admin
    .from("clients")
    .insert({
      agency_id: funnelAgencyId,
      name: clientName,
      contact_email: (diag.payer_email as string | null) ?? null,
      contact_phone: (diag.payer_phone as string | null) ?? null,
      monthly_budget: budgetFromForm > 0 ? budgetFromForm : spendFromFacts,
      mrr: mrrCents / 100,
      status: "onboarding",
      tags: ["origem:diagnostico", "gestao:1997"],
      diagnosis_id: diagnosisId,
      responsible_id: responsibleUserId ?? userId,
      started_at: new Date().toISOString().slice(0, 10),
    })
    .select("id, portal_slug")
    .single();

  if (insErr || !inserted) {
    console.error("provision client insert failed", insErr);
    return jsonResponse({ error: insErr?.message ?? "Falha ao criar cliente" }, 500);
  }

  const clientId = inserted.id as string;

  if (diag.meta_ad_account_id) {
    await admin.from("client_platform_accounts").upsert(
      {
        agency_id: funnelAgencyId,
        client_id: clientId,
        provider: "meta_ads",
        account_external_id: String(diag.meta_ad_account_id),
        account_name: clientName,
        is_active: true,
      },
      { onConflict: "client_id,provider,account_external_id" },
    );
  }

  const checklistRows = CHECKLIST_STEPS.map((s) => ({
    agency_id: funnelAgencyId,
    client_id: clientId,
    step_key: s.key,
    title: s.title,
    status: "pending",
    sort_order: s.sort,
  }));
  await admin.from("onboarding_checklist_items").insert(checklistRows);

  const siteUrl =
    Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/+$/, "") ||
    "https://opus-retention-os.lovable.app";
  const reportUrl = `${siteUrl}/diagnostico/${diagnosisId}?s=${diag.secret_slug}`;
  const noteLines = [
    `Origem: Diagnóstico Meta (gestão R$ 1.997).`,
    `Relatório: ${reportUrl}`,
    diag.management_instagram ? `Instagram: ${diag.management_instagram}` : null,
    diag.management_website ? `Site: ${diag.management_website}` : null,
    submission?.roas_goal ? `Meta ROAS/CPA: ${submission.roas_goal}` : null,
    submission?.access_notes ? `Acessos: ${submission.access_notes}` : null,
    diag.management_payment_method
      ? `Pagamento: ${diag.management_payment_method}`
      : null,
  ].filter(Boolean);

  await admin.from("notes").insert({
    agency_id: funnelAgencyId,
    client_id: clientId,
    author_id: userId,
    content: noteLines.join("\n"),
  });

  const actionRows = actionCenterRowsFromPlan(
    funnelAgencyId,
    clientId,
    diagnosisId,
    analysis,
    userId,
  );
  if (actionRows.length > 0) {
    await admin.from("action_center").insert(actionRows);
  }

  const now = new Date().toISOString();
  await admin
    .from("diagnoses")
    .update({
      management_onboarding_status: "provisioned",
      management_provisioned_at: now,
      management_provisioned_by: userId,
    })
    .eq("id", diagnosisId);

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
    if (budgetExceeded) {
      console.warn(
        JSON.stringify({
          evt: "provision.skip_report_job",
          reason: "ai_budget_exceeded",
          client_id: clientId,
        }),
      );
    } else {
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
          source: "management_provision",
        },
        attempts: 0,
      });
      if (jobErr) {
        console.warn("provision ai_jobs insert failed", jobErr);
      }
    }
  } catch (e) {
    console.warn("provision enqueue report failed", e);
  }

  trace.done({ diagnosis_id: diagnosisId, client_id: clientId });
  return jsonResponse({
    ok: true,
    client_id: clientId,
    portal_slug: inserted.portal_slug,
  });
});
