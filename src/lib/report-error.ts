/**
 * Telemetria central do app.
 * Eventos do funil (via reportFunnelError):
 * - checkout.pix_poll_failed
 * - checkout.mp_sdk_failed
 * - obrigado.status_poll_failed
 * - gestao.status_poll_failed
 * - diagnosis.report_fetch_failed
 * - diagnosis.track_failed
 * Eventos do painel (via reportPanelError):
 * - ai_job_poll, ai_job_realtime, query errors (via QueryCache)
 * Produção: definir window.__RETENTION_REPORT_ERROR__(source, error) para Sentry/Datadog.
 */
export function reportError(source: string, error: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`[reportError:${source}]`, error);
  }
  if (typeof window === "undefined") return;
  const fn = (
    window as unknown as {
      __RETENTION_REPORT_ERROR__?: (s: string, e: unknown) => void;
    }
  ).__RETENTION_REPORT_ERROR__;
  if (typeof fn === "function") {
    try {
      fn(source, error);
    } catch {
      /* ignore third-party failures */
    }
  }
}

export function reportFunnelError(
  event:
    | "checkout.pix_poll_failed"
    | "checkout.mp_sdk_failed"
    | "obrigado.status_poll_failed"
    | "gestao.status_poll_failed"
    | "diagnosis.report_fetch_failed"
    | "diagnosis.track_failed"
    | "diagnosis.funnel_boundary",
  detail: unknown,
): void {
  reportError(`funnel:${event}`, detail);
}

export function reportPanelError(
  event: "ai_job_poll" | "ai_job_realtime" | string,
  detail: unknown,
): void {
  reportError(`panel:${event}`, detail);
}
