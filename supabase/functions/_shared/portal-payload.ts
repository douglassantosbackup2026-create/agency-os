/** Payload sanitizado para portal público (sem intel interna de gestor). */

export type PortalReportSafe = {
  client_friendly_summary: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string | null;
};

export type PortalReportHistoryItem = {
  created_at: string | null;
  period_end: string | null;
  summary_preview: string | null;
};

export function buildPortalReportSafe(
  report: Record<string, unknown> | null | undefined,
): PortalReportSafe | null {
  if (!report) return null;
  return {
    client_friendly_summary:
      typeof report.client_friendly_summary === "string"
        ? report.client_friendly_summary
        : null,
    period_start:
      typeof report.period_start === "string" ? report.period_start : null,
    period_end:
      typeof report.period_end === "string" ? report.period_end : null,
    created_at:
      typeof report.created_at === "string" ? report.created_at : null,
  };
}

export function buildPortalReportHistory(
  reports: Array<Record<string, unknown>>,
  limit = 5,
): PortalReportHistoryItem[] {
  return reports.slice(0, limit).map((r) => {
    const friendly =
      typeof r.client_friendly_summary === "string"
        ? r.client_friendly_summary
        : null;
    const exec =
      typeof r.executive_summary === "string" ? r.executive_summary : null;
    const preview = (friendly ?? exec ?? "").slice(0, 200) || null;
    return {
      created_at: typeof r.created_at === "string" ? r.created_at : null,
      period_end: typeof r.period_end === "string" ? r.period_end : null,
      summary_preview: preview,
    };
  });
}

export function buildPortalHealth(
  health: Record<string, unknown> | null | undefined,
): {
  score: number | null;
  risk: string | null;
  recorded_at: string | null;
  suggested_next_step: string | null;
} | null {
  if (!health) return null;
  let suggested_next_step: string | null = null;
  const expl = health.score_explanation;
  if (expl && typeof expl === "object" && !Array.isArray(expl)) {
    const e = expl as Record<string, unknown>;
    if (typeof e.suggested_next_step === "string") {
      suggested_next_step = e.suggested_next_step;
    }
  }
  return {
    score: typeof health.score === "number" ? health.score : null,
    risk: typeof health.risk === "string" ? health.risk : null,
    recorded_at:
      typeof health.recorded_at === "string" ? health.recorded_at : null,
    suggested_next_step,
  };
}

export function buildPortalGa4Tracking(
  ga4Tracking: Record<string, unknown> | null | undefined,
): { status: string | null; date: string | null } | null {
  if (!ga4Tracking) return null;
  return {
    status:
      typeof ga4Tracking.status === "string" ? ga4Tracking.status : null,
    date: typeof ga4Tracking.date === "string" ? ga4Tracking.date : null,
  };
}
