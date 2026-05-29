/**
 * Cooldown de sync por client_id via sync_runs (Postgres, distribuído).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export async function syncCooldownBlocked(
  admin: SupabaseClient,
  clientId: string,
  agencyId: string,
  provider: string,
): Promise<{ blocked: boolean; waitMinutes?: number }> {
  const cooldownMin = Number(
    Deno.env.get("SYNC_COOLDOWN_MINUTES") ?? "15",
  );
  if (!Number.isFinite(cooldownMin) || cooldownMin <= 0) {
    return { blocked: false };
  }
  const since = new Date(Date.now() - cooldownMin * 60_000).toISOString();
  const { data, error } = await admin
    .from("sync_runs")
    .select("created_at")
    .eq("client_id", clientId)
    .eq("agency_id", agencyId)
    .eq("provider", provider)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.created_at) return { blocked: false };
  const elapsed =
    (Date.now() - new Date(String(data.created_at)).getTime()) / 60_000;
  if (elapsed >= cooldownMin) return { blocked: false };
  return {
    blocked: true,
    waitMinutes: Math.ceil(cooldownMin - elapsed),
  };
}

export async function syncHourlyCapExceeded(
  admin: SupabaseClient,
  agencyId: string,
): Promise<boolean> {
  const max = Number(Deno.env.get("SYNC_MAX_PER_HOUR") ?? "60");
  if (!Number.isFinite(max) || max <= 0) return false;
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count, error } = await admin
    .from("sync_runs")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .gte("created_at", since);
  if (error) return false;
  return (count ?? 0) >= max;
}
