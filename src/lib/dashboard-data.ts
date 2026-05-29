export type OpsSnapshot = {
  open_alerts_count?: number;
  clients_active?: number;
  pending_ai_jobs?: number;
  metrics_clients_28d?: number;
};

export type DashboardCoreData = {
  opsSnapshot: OpsSnapshot | null;
  auditMv: any[];
  clients: any[];
  metrics: any[];
  health: any[];
  campaignMetrics: any[];
  ga4Daily: any[];
  ga4Tracking: any[];
  actionCenter: any[];
  reportsReview: any[];
  agencyBriefing: { buckets?: any; computed_at?: string } | null;
  campaignAuditsSnap: any[];
  checklistItems: any[];
  overdueActionsCount: number;
  openAlerts: any[];
  activities: any[];
};

export function parseDashboardBundle(detail: unknown): DashboardCoreData {
  const bundle = (detail ?? {}) as Record<string, any>;
  return {
    opsSnapshot: (bundle.ops_snapshot ?? null) as OpsSnapshot | null,
    auditMv: (bundle.audit_mv as any[]) ?? [],
    clients: (bundle.clients as any[]) ?? [],
    metrics: (bundle.metrics as any[]) ?? [],
    health: (bundle.health as any[]) ?? [],
    campaignMetrics: (bundle.campaign_metrics as any[]) ?? [],
    ga4Daily: (bundle.ga4_daily as any[]) ?? [],
    ga4Tracking: (bundle.ga4_tracking as any[]) ?? [],
    actionCenter: (bundle.action_center as any[]) ?? [],
    reportsReview: (bundle.reports_review as any[]) ?? [],
    agencyBriefing:
      (bundle.agency_briefing as {
        buckets?: any;
        computed_at?: string;
      } | null) ?? null,
    campaignAuditsSnap: (bundle.campaign_audits as any[]) ?? [],
    checklistItems: (bundle.checklist_items as any[]) ?? [],
    overdueActionsCount: Number(bundle.overdue_actions_count ?? 0),
    openAlerts: (bundle.open_alerts as any[]) ?? [],
    activities: (bundle.activities as any[]) ?? [],
  };
}


export const DASHBOARD_STALE_MS = 60_000;

export function dashboardQueryKey(agencyId: string | undefined) {
  return ["dashboard", agencyId] as const;
}
