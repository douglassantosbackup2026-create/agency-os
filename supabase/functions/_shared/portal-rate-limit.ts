/**
 * Rate limiting rudimentary por isolate Deno (não distribuído entre réplicas).
 * Reduz abuso óbvio; em produção combine com CDN / API Gateway.
 *
 * Env: PORTAL_RATE_LIMIT_MAX_PER_WINDOW (default 120), PORTAL_RATE_LIMIT_WINDOW_MS (default 60000).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function portalClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  if (first) return first;
  return "unknown";
}

export function portalRateLimitExceeded(rateKey: string): boolean {
  const maxRaw = Deno.env.get("PORTAL_RATE_LIMIT_MAX_PER_WINDOW");
  const windowRaw = Deno.env.get("PORTAL_RATE_LIMIT_WINDOW_MS");
  const max = Math.max(1, Number(maxRaw ?? "120") || 120);
  const windowMs = Math.max(
    1000,
    Math.min(3600_000, Number(windowRaw ?? "60000") || 60000),
  );

  const now = Date.now();
  let b = buckets.get(rateKey);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(rateKey, b);
  }
  b.count += 1;
  if (b.count > max) return true;

  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }
  return false;
}
