/**
 * Pré-carga em batch por agência (evita N+1 nos crons evaluate-alerts / compute-health-scores).
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

function groupByClientId<T extends { client_id?: string }>(
  rows: T[],
): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const row of rows) {
    const cid = String(row.client_id ?? "");
    if (!cid) continue;
    const arr = m.get(cid) ?? [];
    arr.push(row);
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

  const [
    metricsRes,
    ga4DailyRes,
    ga4FunnelRes,
    alertsRes,
    notesRes,
    trackingRes,
    mvRes,
    activitiesRes,
  ] = await Promise.all([
    admin
      .from("metrics_daily")
      .select(
        "client_id, date, spend, revenue, roas, cpa, ctr, conversions",
      )
      .in("client_id", clientIds)
      .is("campaign_id", null)
      .gte("date", since)
      .order("date"),
    admin
      .from("ga4_daily")
      .select("client_id, date, sessions, conversions, revenue")
      .in("client_id", clientIds)
      .gte("date", since)
      .order("date"),
    admin
      .from("ga4_funnel_daily")
      .select(
        "client_id, date, add_to_cart, begin_checkout, purchase, add_to_cart_rate, checkout_rate, purchase_rate",
      )
      .in("client_id", clientIds)
      .gte("date", since)
      .order("date"),
    admin
      .from("alerts")
      .select("client_id, type")
      .in("client_id", clientIds)
      .eq("status", "open"),
    admin
      .from("notes")
      .select("client_id, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false }),
    admin
      .from("ga4_tracking_health_daily")
      .select("client_id, date, status, notes, tracking_drop_detected")
      .in("client_id", clientIds)
      .order("date", { ascending: false }),
    agencyId
      ? admin
        .from("client_metrics_28d")
        .select("client_id, days_with_data, spend_28d, roas_28d")
        .eq("agency_id", agencyId)
      : admin
        .from("client_metrics_28d")
        .select("client_id, days_with_data, spend_28d, roas_28d")
        .in("client_id", clientIds),
    admin
      .from("activities")
      .select("client_id, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false }),
  ]);

  if (metricsRes.error) throw metricsRes.error;
  if (ga4DailyRes.error) throw ga4DailyRes.error;
  if (ga4FunnelRes.error) throw ga4FunnelRes.error;
  if (alertsRes.error) throw alertsRes.error;
  if (notesRes.error) throw notesRes.error;
  if (trackingRes.error) throw trackingRes.error;
  if (mvRes.error) throw mvRes.error;
  if (activitiesRes.error) throw activitiesRes.error;

  const metricsRaw = (metricsRes.data ?? []).map((r) => ({
    client_id: String(r.client_id),
    date: String(r.date),
    spend: r.spend,
    revenue: r.revenue,
    roas: r.roas,
    cpa: r.cpa,
    ctr: r.ctr,
    conversions: r.conversions,
  }));

  const metricsByClient = new Map<string, MetricDailyRow[]>();
  for (const row of metricsRaw) {
    const arr = metricsByClient.get(row.client_id) ?? [];
    arr.push({
      date: row.date,
      spend: row.spend,
      revenue: row.revenue,
      roas: row.roas,
      cpa: row.cpa,
      ctr: row.ctr,
      conversions: row.conversions,
    });
    metricsByClient.set(row.client_id, arr);
  }

  const ga4DailyByClient = new Map<string, Ga4DailyRow[]>();
  for (const row of ga4DailyRes.data ?? []) {
    const cid = String(row.client_id);
    const arr = ga4DailyByClient.get(cid) ?? [];
    arr.push({
      date: String(row.date),
      sessions: row.sessions,
      conversions: row.conversions,
      revenue: row.revenue,
    });
    ga4DailyByClient.set(cid, arr);
  }

  const ga4FunnelByClient = new Map<string, Ga4FunnelRow[]>();
  for (const row of ga4FunnelRes.data ?? []) {
    const cid = String(row.client_id);
    const arr = ga4FunnelByClient.get(cid) ?? [];
    arr.push(row as Ga4FunnelRow);
    ga4FunnelByClient.set(cid, arr);
  }

  const openAlertTypesByClient = new Map<string, Set<string>>();
  for (const row of alertsRes.data ?? []) {
    const cid = String(row.client_id);
    const set = openAlertTypesByClient.get(cid) ?? new Set<string>();
    if (row.type) set.add(String(row.type));
    openAlertTypesByClient.set(cid, set);
  }

  const lastNoteAtByClient = new Map<string, string>();
  for (const row of notesRes.data ?? []) {
    const cid = String(row.client_id);
    if (!lastNoteAtByClient.has(cid) && row.created_at) {
      lastNoteAtByClient.set(cid, String(row.created_at));
    }
  }

  const trackingByClient = new Map<
    string,
    { status: string; notes?: string | null }
  >();
  for (const row of trackingRes.data ?? []) {
    const cid = String(row.client_id);
    if (!trackingByClient.has(cid)) {
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
  for (const row of mvRes.data ?? []) {
    metrics28dByClient.set(String(row.client_id), {
      days_with_data: Number(row.days_with_data ?? 0),
      spend_28d: Number(row.spend_28d ?? 0),
      roas_28d: Number(row.roas_28d ?? 0),
    });
  }

  const lastActivityAtByClient = new Map<string, string>();
  for (const row of activitiesRes.data ?? []) {
    const cid = String(row.client_id);
    if (!lastActivityAtByClient.has(cid) && row.created_at) {
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
