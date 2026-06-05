import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { callDiagnosisApi } from "@/lib/diagnosis-api";
import { parseDiagnosisFailedReason } from "@/lib/diagnosis-failed-reason";
import { whatsappGestaoHref } from "@/lib/gestao-whatsapp";
import { reportFunnelError } from "@/lib/report-error";
import { toast } from "sonner";

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
  title = "Algo correu mal",
  className = "mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 animate-fade-in",
  showHomeLink = true,
  showStatusLink = false,
}: Props) {
  const parsed = parseDiagnosisFailedReason(failedReason);
  const [retrying, setRetrying] = useState(false);

  const supportHref = whatsappGestaoHref(
    `Olá! O meu diagnóstico Meta Ads falhou e preciso de ajuda. ID: ${diagnosisId}`,
  );

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    reportFunnelError("diagnosis.retry_requested", { diagnosisId });
    try {
      await callDiagnosisApi<{ ok?: boolean; status?: string }>(
        "diagnosis-retry",
        { method: "POST", query: { d: diagnosisId, s: secretSlug } },
      );
      onRetrySuccess?.();
    } catch (err) {
      reportFunnelError("diagnosis.retry_failed", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Não foi possível tentar novamente. Tenta em instantes.",
      );
    } finally {
      setRetrying(false);
    }
  }, [diagnosisId, secretSlug, onRetrySuccess]);

  const showMeta =
    parsed.showMetaReconnect && Boolean(metaOAuthUrl);

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
                disabled={retrying}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {retrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Tentar novamente
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
                Contactar suporte
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

