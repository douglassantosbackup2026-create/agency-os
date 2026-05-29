export type OpsSnapshot = {
  open_alerts_count?: number;
  clients_active?: number;
  pending_ai_jobs?: number;
  metrics_clients_28d?: number;
};

export type DashboardCoreData = {
  opsSnapshot: OpsSnapshot | null;
  auditMv: unknown[];
  clients: unknown[];
  metrics: unknown[];
  health: unknown[];
  campaignMetrics: unknown[];
  ga4Daily: unknown[];
  ga4Tracking: unknown[];
  actionCenter: unknown[];
  reportsReview: unknown[];
  agencyBriefing: { buckets?: unknown; computed_at?: string } | null;
  campaignAuditsSnap: unknown[];
  checklistItems: unknown[];
  overdueActionsCount: number;
  openAlerts: unknown[];
  activities: unknown[];
};

export function parseDashboardBundle(detail: unknown): DashboardCoreData {
  const bundle = (detail ?? {}) as Record<string, unknown>;
  return {
    opsSnapshot: (bundle.ops_snapshot ?? null) as OpsSnapshot | null,
    auditMv: (bundle.audit_mv as unknown[]) ?? [],
    clients: (bundle.clients as unknown[]) ?? [],
    metrics: (bundle.metrics as unknown[]) ?? [],
    health: (bundle.health as unknown[]) ?? [],
    campaignMetrics: (bundle.campaign_metrics as unknown[]) ?? [],
    ga4Daily: (bundle.ga4_daily as unknown[]) ?? [],
    ga4Tracking: (bundle.ga4_tracking as unknown[]) ?? [],
    actionCenter: (bundle.action_center as unknown[]) ?? [],
    reportsReview: (bundle.reports_review as unknown[]) ?? [],
    agencyBriefing:
      (bundle.agency_briefing as {
        buckets?: unknown;
        computed_at?: string;
      } | null) ?? null,
    campaignAuditsSnap: (bundle.campaign_audits as unknown[]) ?? [],
    checklistItems: (bundle.checklist_items as unknown[]) ?? [],
    overdueActionsCount: Number(bundle.overdue_actions_count ?? 0),
    openAlerts: (bundle.open_alerts as unknown[]) ?? [],
    activities: (bundle.activities as unknown[]) ?? [],
  };
}

export const DASHBOARD_STALE_MS = 60_000;

export function dashboardQueryKey(agencyId: string | undefined) {
  return ["dashboard", agencyId] as const;
}
