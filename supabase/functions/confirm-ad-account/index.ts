// Confirma a conta de anúncio Meta escolhida pelo usuário após OAuth.
// Valida que o accountId está dentro de pending_ad_accounts e dispara o
// processamento.

import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertDiagnosisSecret } from "../_shared/diagnosis/validate-diagnosis-access.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";

function triggerProcess(): void {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return;
  const base = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  fetch(`${base}/functions/v1/process-diagnosis`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  }).catch(() => undefined);
}

type PendingAccount = {
  id?: string;
  account_id?: string;
  name?: string;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "confirm_ad_account");
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: { diagnosisId?: string; secretSlug?: string; accountId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const d = String(body.diagnosisId ?? "");
  const s = String(body.secretSlug ?? "");
  const rawAccountId = String(body.accountId ?? "").trim();
  if (!rawAccountId) {
    return jsonResponse({ error: "accountId obrigatório" }, 400);
  }

  const gate = await assertDiagnosisSecret(d, s);
  if (!gate.ok) return jsonResponse({ error: gate.message }, gate.status);

  const sb = diagnosisServiceClient();
  const { data: row, error } = await sb
    .from("diagnoses")
    .select("status, pending_ad_accounts")
    .eq("id", d)
    .eq("secret_slug", s)
    .maybeSingle();
  if (error) {
    console.error(error);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
  if (!row) return jsonResponse({ error: "não encontrado" }, 404);
  if (row.status !== "awaiting_account_selection") {
    return jsonResponse(
      { error: "Diagnóstico não está aguardando seleção de conta" },
      422,
    );
  }

  const pending = (row.pending_ad_accounts ?? []) as PendingAccount[];
  if (!Array.isArray(pending) || pending.length === 0) {
    return jsonResponse({ error: "Sem contas pendentes" }, 422);
  }

  // Normaliza para "act_<id>"
  const normalized = rawAccountId.startsWith("act_")
    ? rawAccountId
    : `act_${rawAccountId.replace(/^act_/, "")}`;

  const match = pending.find((a) => {
    const aId = a.id ?? "";
    const aAcc = a.account_id ?? "";
    const candidates = new Set<string>(
      [
        aId,
        aAcc,
        aId.startsWith("act_") ? aId : `act_${aAcc}`,
        `act_${aAcc}`,
      ].filter(Boolean),
    );
    return candidates.has(rawAccountId) || candidates.has(normalized);
  });

  if (!match) {
    return jsonResponse({ error: "Conta inválida" }, 400);
  }

  const finalActId =
    (match.id && match.id.startsWith("act_") ? match.id : null) ??
    (match.account_id ? `act_${match.account_id}` : normalized);

  const { error: eUp } = await sb
    .from("diagnoses")
    .update({
      meta_ad_account_id: finalActId,
      pending_ad_accounts: null,
      status: "processing",
    })
    .eq("id", d)
    .eq("secret_slug", s)
    .eq("status", "awaiting_account_selection");

  if (eUp) {
    console.error(eUp);
    return jsonResponse({ error: "Falha ao atualizar diagnóstico" }, 500);
  }

  triggerProcess();
  trace.done({ accountId: finalActId });
  return jsonResponse({ ok: true, meta_ad_account_id: finalActId });
});
