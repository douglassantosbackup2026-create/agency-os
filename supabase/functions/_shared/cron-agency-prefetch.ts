/**
 * Pré-carga em batch por agência (1 RPC — critério P2 ≤3 queries principais).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type MetricDailyRow = {
  date: string;
  spend: number | null;
  revenue: number | null;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
  conversions: number | null;
};

export type Ga4DailyRow = {
  date: string;
  sessions: number | null;
  conversions: number | null;
  revenue: number | null;
  conversion_rate?: number | null;
  avg_ticket?: number | null;
};

export type Ga4FunnelRow = {
  date: string;
  add_to_cart?: number | null;
  begin_checkout?: number | null;
  purchase?: number | null;
  add_to_cart_rate?: number | null;
  checkout_rate?: number | null;
  purchase_rate?: number | null;
};

export type AgencyCronPrefetch = {
  metricsByClient: Map<string, MetricDailyRow[]>;
  ga4DailyByClient: Map<string, Ga4DailyRow[]>;
  ga4FunnelByClient: Map<string, Ga4FunnelRow[]>;
  openAlertTypesByClient: Map<string, Set<string>>;
  lastNoteAtByClient: Map<string, string>;
  trackingByClient: Map<string, { status: string; notes?: string | null }>;
  metrics28dByClient: Map<
    string,
    { days_with_data: number; spend_28d: number; roas_28d: number }
  >;
  lastActivityAtByClient: Map<string, string>;
};

function groupMetricsByClient(
  rows: Array<Record<string, unknown>>,
): Map<string, MetricDailyRow[]> {
  const m = new Map<string, MetricDailyRow[]>();
  for (const row of rows) {
    const cid = String(row.client_id ?? "");
    if (!cid) continue;
    const arr = m.get(cid) ?? [];
    arr.push({
      date: String(row.date),
      spend: row.spend as number | null,
      revenue: row.revenue as number | null,
      roas: row.roas as number | null,
      cpa: row.cpa as number | null,
      ctr: row.ctr as number | null,
      conversions: row.conversions as number | null,
    });
    m.set(cid, arr);
  }
  return m;
}

function groupGa4DailyByClient(
  rows: Array<Record<string, unknown>>,
): Map<string, Ga4DailyRow[]> {
  const m = new Map<string, Ga4DailyRow[]>();
  for (const row of rows) {
    const cid = String(row.client_id ?? "");
    if (!cid) continue;
    const arr = m.get(cid) ?? [];
    arr.push({
      date: String(row.date),
      sessions: row.sessions as number | null,
      conversions: row.conversions as number | null,
      revenue: row.revenue as number | null,
    });
    m.set(cid, arr);
  }
  return m;
}

function groupGa4FunnelByClient(
  rows: Array<Record<string, unknown>>,
): Map<string, Ga4FunnelRow[]> {
  const m = new Map<string, Ga4FunnelRow[]>();
  for (const row of rows) {
    const cid = String(row.client_id ?? "");
    if (!cid) continue;
    const arr = m.get(cid) ?? [];
    arr.push(row as Ga4FunnelRow);
    m.set(cid, arr);
  }
  return m;
}

export async function prefetchAgencyCronData(
  admin: SupabaseClient,
  clientIds: string[],
  agencyId: string | undefined,
  since: string,
): Promise<AgencyCronPrefetch> {
  const empty: AgencyCronPrefetch = {
    metricsByClient: new Map(),
    ga4DailyByClient: new Map(),
    ga4FunnelByClient: new Map(),
    openAlertTypesByClient: new Map(),
    lastNoteAtByClient: new Map(),
    trackingByClient: new Map(),
    metrics28dByClient: new Map(),
    lastActivityAtByClient: new Map(),
  };

  if (!clientIds.length) return empty;

  const { data, error } = await admin.rpc("get_agency_cron_prefetch", {
    p_agency_id: agencyId ?? null,
    p_client_ids: clientIds,
    p_since: since,
  });
  if (error) throw error;

  const bundle = (data ?? {}) as Record<string, unknown>;
  const metricsByClient = groupMetricsByClient(
    (bundle.metrics_daily as Array<Record<string, unknown>>) ?? [],
  );
  const ga4DailyByClient = groupGa4DailyByClient(
    (bundle.ga4_daily as Array<Record<string, unknown>>) ?? [],
  );
  const ga4FunnelByClient = groupGa4FunnelByClient(
    (bundle.ga4_funnel as Array<Record<string, unknown>>) ?? [],
  );

  const openAlertTypesByClient = new Map<string, Set<string>>();
  for (const row of (bundle.open_alerts as Array<Record<string, unknown>>) ??
    []) {
    const cid = String(row.client_id ?? "");
    const set = openAlertTypesByClient.get(cid) ?? new Set<string>();
    if (row.type) set.add(String(row.type));
    openAlertTypesByClient.set(cid, set);
  }

  const lastNoteAtByClient = new Map<string, string>();
  for (const row of (bundle.notes as Array<Record<string, unknown>>) ?? []) {
    const cid = String(row.client_id ?? "");
    if (cid && row.created_at) {
      lastNoteAtByClient.set(cid, String(row.created_at));
    }
  }

  const trackingByClient = new Map<
    string,
    { status: string; notes?: string | null }
  >();
  for (const row of (bundle.tracking as Array<Record<string, unknown>>) ??
    []) {
    const cid = String(row.client_id ?? "");
    if (cid) {
      trackingByClient.set(cid, {
        status: String(row.status ?? ""),
        notes: row.notes as string | null,
      });
    }
  }

  const metrics28dByClient = new Map<
    string,
    { days_with_data: number; spend_28d: number; roas_28d: number }
  >();
  for (const row of (bundle.metrics_28d as Array<Record<string, unknown>>) ??
    []) {
    metrics28dByClient.set(String(row.client_id), {
      days_with_data: Number(row.days_with_data ?? 0),
      spend_28d: Number(row.spend_28d ?? 0),
      roas_28d: Number(row.roas_28d ?? 0),
    });
  }

  const lastActivityAtByClient = new Map<string, string>();
  for (const row of (bundle.activities as Array<Record<string, unknown>>) ??
    []) {
    const cid = String(row.client_id ?? "");
    if (cid && row.created_at) {
      lastActivityAtByClient.set(cid, String(row.created_at));
    }
  }

  return {
    metricsByClient,
    ga4DailyByClient,
    ga4FunnelByClient,
    openAlertTypesByClient,
    lastNoteAtByClient,
    trackingByClient,
    metrics28dByClient,
    lastActivityAtByClient,
  };
}

/** Gate MV: cliente sem dados suficientes nos últimos 28d. */
export function clientHasMinMetricsData(
  prefetch: AgencyCronPrefetch,
  clientId: string,
  minDays = 7,
): boolean {
  const mv = prefetch.metrics28dByClient.get(clientId);
  if (mv) return mv.days_with_data >= minDays;
  return (prefetch.metricsByClient.get(clientId)?.length ?? 0) >= minDays;
}
