import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { publicClientIp, publicRateLimitExceeded } from "../_shared/public-rate-limit.ts";

const DIAGNOSIS_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_KINDS = new Set([
  "whatsapp_click",
  "report_back_click",
  "whatsapp_view",
]);

/**
 * Regista um evento de handoff pós-pagamento (clique no botão de WhatsApp,
 * etc.). Endpoint público (chamado via navigator.sendBeacon do browser);
 * autenticação por `secret_slug` do diagnóstico.
 */
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
  const kind = String(body.kind ?? "").trim();
  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : null;

  if (!DIAGNOSIS_ID_RE.test(diagnosisId) || !secret) {
    return jsonResponse({ error: "diagnóstico inválido" }, 400);
  }
  if (!ALLOWED_KINDS.has(kind)) {
    return jsonResponse({ error: "kind inválido" }, 400);
  }

  const sb = diagnosisServiceClient();
  const ip = publicClientIp(req);
  if (await publicRateLimitExceeded(sb, `mgmt-handoff:${ip}`)) {
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

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const { error: insErr } = await sb.from("diagnosis_handoff_events").insert({
    diagnosis_id: diagnosisId,
    kind,
    ip,
    user_agent: userAgent,
    payload,
  });
  if (insErr) {
    console.error(
      JSON.stringify({
        evt: "log_management_handoff.insert_failed",
        diagnosis_id: diagnosisId,
        err: String(insErr.message ?? insErr),
      }),
    );
    return jsonResponse({ error: "log_failed" }, 500);
  }

  // Carimba a coluna desnormalizada apenas no clique do WhatsApp.
  if (kind === "whatsapp_click") {
    await sb
      .from("diagnoses")
      .update({ management_whatsapp_clicked_at: new Date().toISOString() })
      .eq("id", diagnosisId)
      .is("management_whatsapp_clicked_at", null);
  }

  return jsonResponse({ ok: true }, 200);
});
