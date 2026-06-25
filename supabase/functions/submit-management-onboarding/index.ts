import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";

const DIAGNOSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACCESS_OPTIONS = new Set([
  "business_manager",
  "catalog",
  "shopify",
  "pixel",
  "ga4",
  "other",
]);

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const diagnosisId = String(body.diagnosis_id ?? "").trim();
  const secret = String(body.secret_slug ?? "").trim();
  if (!DIAGNOSIS_ID_RE.test(diagnosisId) || !secret) {
    return jsonResponse({ error: "diagnóstico inválido" }, 400);
  }

  const sb = diagnosisServiceClient();
  const ip = publicClientIp(req);
  if (await publicRateLimitExceeded(sb, `mgmt-onboarding:${ip}`)) {
    return jsonResponse({ error: "Muitas tentativas." }, 429);
  }

  const { data: diag } = await sb
    .from("diagnoses")
    .select("id, secret_slug, management_status")
    .eq("id", diagnosisId)
    .maybeSingle();

  if (!diag || diag.secret_slug !== secret) {
    return jsonResponse({ error: "diagnóstico não encontrado" }, 404);
  }
  if (diag.management_status !== "paid") {
    return jsonResponse({ error: "Gestão ainda não confirmada" }, 403);
  }

  const monthlyAdBudget = body.monthly_ad_budget != null
    ? Number(body.monthly_ad_budget)
    : null;
  const roasGoal = String(body.roas_goal ?? "").trim().slice(0, 500) || null;
  const preferredContactTime =
    String(body.preferred_contact_time ?? "").trim().slice(0, 200) || null;
  const accessNotes = String(body.access_notes ?? "").trim().slice(0, 2000) || null;

  const rawChecklist = Array.isArray(body.access_checklist)
    ? body.access_checklist
    : [];
  const accessChecklist = rawChecklist
    .map((x) => String(x).trim())
    .filter((x) => ACCESS_OPTIONS.has(x))
    .slice(0, 10);

  const { error: upsErr } = await sb.from("management_onboarding_submissions").upsert(
    {
      diagnosis_id: diagnosisId,
      submitted_at: new Date().toISOString(),
      monthly_ad_budget: Number.isFinite(monthlyAdBudget) ? monthlyAdBudget : null,
      roas_goal: roasGoal,
      preferred_contact_time: preferredContactTime,
      access_notes: accessNotes,
      access_checklist: accessChecklist,
      extra_json: {},
      ip,
    },
    { onConflict: "diagnosis_id" },
  );
  if (upsErr) {
    console.error("submit-management-onboarding upsert failed", upsErr);
    return jsonResponse({ error: "Falha ao guardar" }, 500);
  }

  await sb
    .from("diagnoses")
    .update({ management_onboarding_status: "client_submitted" })
    .eq("id", diagnosisId)
    .in("management_onboarding_status", ["none", "awaiting_client", "client_submitted"]);

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  await sb.from("diagnosis_handoff_events").insert({
    diagnosis_id: diagnosisId,
    kind: "onboarding_submitted",
    ip,
    user_agent: userAgent,
    payload: {
      monthly_ad_budget: monthlyAdBudget,
      access_checklist: accessChecklist,
    },
  });

  return jsonResponse({ ok: true });
});
