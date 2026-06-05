import { handleCors, jsonResponse } from "../_shared/diagnosis/cors.ts";
import { assertDiagnosisSecret } from "../_shared/diagnosis/validate-diagnosis-access.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { triggerProcessDiagnosis } from "../_shared/diagnosis/trigger-process-diagnosis.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { distributedRateLimitExceeded } from "../_shared/distributed-rate-limit.ts";

const RETRY_COOLDOWN_SEC = 120;

function isMetaTokenFailure(reason: string | null | undefined): boolean {
  return /token meta|reconect/i.test(reason ?? "");
}

function isNonRetryableFailure(reason: string | null | undefined): boolean {
  if (!reason) return false;
  if (isMetaTokenFailure(reason)) return true;
  if (/Orçamento diário de IA/.test(reason)) return true;
  if (/Configuração de IA incompleta/.test(reason)) return true;
  return false;
}

function cooldownResponse(updatedAt: string | null | undefined) {
  const elapsed = updatedAt
    ? Date.now() - new Date(updatedAt).getTime()
    : 0;
  const waitSec = Math.max(
    1,
    Math.ceil((RETRY_COOLDOWN_SEC * 1000 - elapsed) / 1000),
  );
  return jsonResponse(
    {
      error: `Aguarda ${waitSec} segundos antes de tentar novamente.`,
      code: "retry_cooldown",
      retry_after_sec: waitSec,
    },
    429,
  );
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const trace = beginEdgeTrace(req, "diagnosis_retry");
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const url = new URL(req.url);
  let d = url.searchParams.get("d") ?? "";
  let s = url.searchParams.get("s") ?? "";

  if (!d || !s) {
    try {
      const body = (await req.json()) as {
        diagnosisId?: string;
        secretSlug?: string;
      };
      d = String(body.diagnosisId ?? d);
      s = String(body.secretSlug ?? s);
    } catch {
      /* query params only */
    }
  }

  const gate = await assertDiagnosisSecret(d, s);
  if (!gate.ok) return jsonResponse({ error: gate.message }, gate.status);

  const sb = diagnosisServiceClient();
  const { data: row, error } = await sb
    .from("diagnoses")
    .select("status, failed_reason, meta_ad_account_id, updated_at")
    .eq("id", d)
    .eq("secret_slug", s)
    .maybeSingle();

  if (error) {
    console.error(error);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
  if (!row) return jsonResponse({ error: "não encontrado" }, 404);

  if (row.status !== "failed") {
    return jsonResponse(
      { error: "Diagnóstico não está em estado de falha" },
      422,
    );
  }

  const updatedAt = row.updated_at as string | null | undefined;
  if (
    updatedAt &&
    Date.now() - new Date(updatedAt).getTime() < RETRY_COOLDOWN_SEC * 1000
  ) {
    return cooldownResponse(updatedAt);
  }

  const rateLimited = await distributedRateLimitExceeded(
    sb,
    `diagnosis-retry:${d}`,
    1,
    RETRY_COOLDOWN_SEC,
  );
  if (rateLimited) {
    return cooldownResponse(updatedAt);
  }

  if (isNonRetryableFailure(row.failed_reason)) {
    const msg = isMetaTokenFailure(row.failed_reason)
      ? "Reconecta a conta Meta antes de tentar novamente."
      : (row.failed_reason ?? "Não é possível tentar novamente agora.");
    return jsonResponse({ error: msg }, 422);
  }

  if (!row.meta_ad_account_id) {
    return jsonResponse(
      { error: "Conta Meta não ligada. Conecta a Meta antes de tentar novamente." },
      422,
    );
  }

  const { error: eUp } = await sb
    .from("diagnoses")
    .update({
      status: "processing",
      failed_reason: null,
    })
    .eq("id", d)
    .eq("secret_slug", s)
    .eq("status", "failed");

  if (eUp) {
    console.error(eUp);
    return jsonResponse({ error: "Falha ao reiniciar diagnóstico" }, 500);
  }

  triggerProcessDiagnosis("diagnosis-retry");
  trace.done({ diagnosisId: d });
  return jsonResponse({ ok: true, status: "processing" });
});
