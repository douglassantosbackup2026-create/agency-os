/**
 * Rate limit distribuído via RPC check_api_rate_limit; fallback in-memory.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type MemBucket = { count: number; resetAt: number };
const memBuckets = new Map<string, MemBucket>();

function memoryExceeded(
  rateKey: string,
  max: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  let b = memBuckets.get(rateKey);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    memBuckets.set(rateKey, b);
  }
  b.count += 1;
  return b.count > max;
}

export async function distributedRateLimitExceeded(
  admin: SupabaseClient,
  rateKey: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("check_api_rate_limit", {
      p_bucket: rateKey,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (!error && typeof data === "boolean") return data;
    if (error) {
      console.warn("check_api_rate_limit fallback", error.message);
    }
  } catch (e) {
    console.warn("check_api_rate_limit exception", String(e));
  }
  return memoryExceeded(rateKey, max, windowSeconds * 1000);
}
