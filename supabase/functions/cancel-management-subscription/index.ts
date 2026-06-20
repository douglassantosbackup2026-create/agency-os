import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertPlatformAdmin } from "../_shared/assert-platform-admin.ts";
import { cancelMpPreapproval } from "../_shared/mp-preapproval.ts";

/**
 * Endpoint admin: cancela uma assinatura recorrente de gestão no Mercado Pago
 * e marca como `cancelled` na tabela `management_subscriptions`.
 *
 * Body: { subscription_id?: string, diagnosis_id?: string, reason?: string }
 * Requer usuário autenticado com `profiles.is_platform_admin = true`.
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, req);
  }

  const auth = await assertPlatformAdmin(req.headers.get("authorization"));
  if (!auth.ok) return jsonResponse({ error: auth.message }, auth.status, req);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400, req);
  }

  const subscriptionId = typeof body.subscription_id === "string" ? body.subscription_id.trim() : "";
  const diagnosisId = typeof body.diagnosis_id === "string" ? body.diagnosis_id.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;

  if (!subscriptionId && !diagnosisId) {
    return jsonResponse({ error: "Informe subscription_id ou diagnosis_id" }, 400, req);
  }

  const query = auth.admin
    .from("management_subscriptions")
    .select("id, diagnosis_id, mp_preapproval_id, status")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: sub, error: subErr } = subscriptionId
    ? await query.eq("id", subscriptionId).maybeSingle()
    : await query.eq("diagnosis_id", diagnosisId).maybeSingle();

  if (subErr) return jsonResponse({ error: subErr.message }, 500, req);
  if (!sub) return jsonResponse({ error: "Assinatura não encontrada" }, 404, req);
  if (sub.status === "cancelled") {
    return jsonResponse({ ok: true, already_cancelled: true, subscription_id: sub.id }, 200, req);
  }
  if (!sub.mp_preapproval_id) {
    return jsonResponse({ error: "Assinatura sem mp_preapproval_id" }, 422, req);
  }

  const mp = await cancelMpPreapproval(sub.mp_preapproval_id);
  if (!mp.ok) {
    return jsonResponse(
      { error: "Falha ao cancelar no Mercado Pago", mp_status: mp.status, mp_response: mp.json },
      502,
      req,
    );
  }

  const now = new Date().toISOString();
  const { error: updErr } = await auth.admin
    .from("management_subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: now,
      last_event_at: now,
      last_payload: { source: "admin_cancel", reason, mp: mp.json, by: auth.userId },
    })
    .eq("id", sub.id);

  if (updErr) return jsonResponse({ error: updErr.message }, 500, req);

  await auth.admin
    .from("diagnoses")
    .update({ management_status: "cancelled" })
    .eq("id", sub.diagnosis_id);

  return jsonResponse(
    { ok: true, subscription_id: sub.id, diagnosis_id: sub.diagnosis_id, mp: mp.json },
    200,
    req,
  );
});
