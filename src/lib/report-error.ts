/** Ponto único para telemetria; em DEV faz log. Opcional: `window.__RETENTION_REPORT_ERROR__(source, error)`. */
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
