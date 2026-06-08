import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { callDiagnosisApi, DiagnosisApiError } from "@/lib/diagnosis-api";
import { parseDiagnosisFailedReason } from "@/lib/diagnosis-failed-reason";
import { whatsappGestaoHref } from "@/lib/gestao-whatsapp";
import { reportFunnelError } from "@/lib/report-error";
import { toast } from "sonner";

const RETRY_COOLDOWN_SEC = 120;

type Props = {
  failedReason: string | null | undefined;
  diagnosisId: string;
  secretSlug: string;
  metaOAuthUrl?: string;
  onRetrySuccess?: () => void;
  title?: string;
  className?: string;
  showHomeLink?: boolean;
  showStatusLink?: boolean;
};

export function DiagnosisFailedPanel({
  failedReason,
  diagnosisId,
  secretSlug,
  metaOAuthUrl = "",
  onRetrySuccess,
  title = "Algo deu errado",
  className = "mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 animate-fade-in",
  showHomeLink = true,
  showStatusLink = false,
}: Props) {
  const parsed = parseDiagnosisFailedReason(failedReason);
  const [retrying, setRetrying] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = window.setInterval(() => {
      setCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [cooldownSec]);

  const supportHref = whatsappGestaoHref(
    `Olá! Meu diagnóstico Meta Ads falhou e preciso de ajuda. ID: ${diagnosisId}`,
  );

  const startCooldown = useCallback((seconds = RETRY_COOLDOWN_SEC) => {
    setCooldownSec(seconds);
  }, []);

  const handleRetry = useCallback(async () => {
    if (cooldownSec > 0) return;
    setRetrying(true);
    reportFunnelError("diagnosis.retry_requested", { diagnosisId });
    try {
      await callDiagnosisApi<{ ok?: boolean; status?: string }>(
        "diagnosis-retry",
        { method: "POST", query: { d: diagnosisId, s: secretSlug } },
      );
      startCooldown();
      onRetrySuccess?.();
    } catch (err) {
      reportFunnelError("diagnosis.retry_failed", err);
      if (err instanceof DiagnosisApiError && err.status === 429) {
        const body = err.message.match(/(\d+)\s+segundos/);
        const wait = body ? Number(body[1]) : RETRY_COOLDOWN_SEC;
        startCooldown(wait);
      }
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível tentar novamente. Tente em instantes.",
      );
    } finally {
      setRetrying(false);
    }
  }, [
    cooldownSec,
    diagnosisId,
    secretSlug,
    onRetrySuccess,
    startCooldown,
  ]);

  const showMeta =
    parsed.showMetaReconnect && Boolean(metaOAuthUrl);
  const retryDisabled = retrying || cooldownSec > 0;

  return (
    <div className={className}>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-destructive">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{parsed.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {parsed.showRetry ? (
              <button
                type="button"
                onClick={() => void handleRetry()}
                disabled={retryDisabled}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {retrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {cooldownSec > 0
                  ? `Aguarde ${cooldownSec}s`
                  : "Tentar novamente"}
              </button>
            ) : null}
            {showMeta ? (
              <a
                href={metaOAuthUrl}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Reconectar Meta
              </a>
            ) : null}
            {parsed.kind === "support" ? (
              <a
                href={supportHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium hover:bg-accent"
              >
                Falar com suporte
              </a>
            ) : null}
            {showStatusLink ? (
              <Link
                to="/obrigado"
                search={{ d: diagnosisId, s: secretSlug }}
                className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium hover:bg-accent"
              >
                Ver status do pedido
              </Link>
            ) : null}
            {showHomeLink ? (
              <Link
                to="/"
                className="inline-flex h-10 items-center justify-center rounded-lg border px-4 text-sm font-medium hover:bg-accent"
              >
                Voltar ao início
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
