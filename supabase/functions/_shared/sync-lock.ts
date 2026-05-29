/**
 * Lock distribuído de sync via sync_runs.status = running.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type SyncRunLock = {
  runId: string;
  agency_id: string;
  client_id: string;
  provider: string;
  startedAt: number;
};

export type AcquireSyncLockResult =
  | { ok: true; lock: SyncRunLock }
  | { ok: false; reason: "in_progress" | "db_error"; message?: string };

export async function acquireSyncLock(
  admin: SupabaseClient,
  agency_id: string,
  client_id: string,
  provider: string,
): Promise<AcquireSyncLockResult> {
  const { data, error } = await admin
    .from("sync_runs")
    .insert({
      agency_id,
      client_id,
      provider,
      status: "running",
      duration_ms: null,
      error_message: null,
    })
    .select("id, created_at")
    .single();

  if (error) {
    const code = String((error as { code?: string }).code ?? "");
    if (code === "23505") {
      return { ok: false, reason: "in_progress" };
    }
    return { ok: false, reason: "db_error", message: error.message };
  }

  return {
    ok: true,
    lock: {
      runId: String(data.id),
      agency_id,
      client_id,
      provider,
      startedAt: Date.now(),
    },
  };
}

export async function finishSyncLock(
  admin: SupabaseClient,
  lock: SyncRunLock,
  outcome: {
    status: "ok" | "warning" | "error";
    error_message?: string | null;
  },
): Promise<void> {
  const duration_ms = Math.max(0, Date.now() - lock.startedAt);
  await admin
    .from("sync_runs")
    .update({
      status: outcome.status,
      duration_ms,
      error_message: outcome.error_message ?? null,
    })
    .eq("id", lock.runId);
}

export type MetricRowUpsert = {
  agency_id: string;
  client_id: string;
  campaign_id?: string | null;
  date: string;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  roas: number;
  cpa: number;
  ctr: number;
};

const UPSERT_CHUNK = 500;

export async function upsertMetricsDaily(
  admin: SupabaseClient,
  rows: MetricRowUpsert[],
): Promise<{ error?: string }> {
  if (!rows.length) return {};
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK).map((r) => ({
      agency_id: r.agency_id,
      client_id: r.client_id,
      campaign_id: r.campaign_id ?? null,
      date: r.date,
      spend: r.spend,
      revenue: r.revenue,
      conversions: r.conversions,
      impressions: r.impressions,
      clicks: r.clicks,
      roas: r.roas,
      cpa: r.cpa,
      ctr: r.ctr,
    }));
    const { error } = await admin.rpc("upsert_metrics_daily_batch", {
      p_rows: chunk,
    });
    if (error) return { error: error.message };
  }
  return {};
}
