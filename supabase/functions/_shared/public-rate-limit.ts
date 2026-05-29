/**
 * Rate limit distribuído para checkout/endpoints públicos.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { distributedRateLimitExceeded } from "./distributed-rate-limit.ts";

export function publicClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  if (first) return first;
  return "unknown";
}

export async function publicRateLimitExceeded(
  admin: SupabaseClient,
  rateKey: string,
): Promise<boolean> {
  const max = Math.max(
    1,
    Number(Deno.env.get("PUBLIC_RATE_LIMIT_MAX_PER_WINDOW") ?? "30") || 30,
  );
  const windowSec = Math.max(
    1,
    Math.floor(
      (Number(Deno.env.get("PUBLIC_RATE_LIMIT_WINDOW_MS") ?? "60000") ||
        60000) / 1000,
    ),
  );
  return distributedRateLimitExceeded(admin, rateKey, max, windowSec);
}
