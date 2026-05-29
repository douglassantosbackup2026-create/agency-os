/**
 * Rate limit in-memory por isolate (checkout público, etc.).
 * Env: PUBLIC_RATE_LIMIT_MAX_PER_WINDOW (default 30), PUBLIC_RATE_LIMIT_WINDOW_MS (default 60000).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function publicClientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  if (first) return first;
  return "unknown";
}

export function publicRateLimitExceeded(rateKey: string): boolean {
  const max = Math.max(
    1,
    Number(Deno.env.get("PUBLIC_RATE_LIMIT_MAX_PER_WINDOW") ?? "30") || 30,
  );
  const windowMs = Math.max(
    1000,
    Math.min(
      3600_000,
      Number(Deno.env.get("PUBLIC_RATE_LIMIT_WINDOW_MS") ?? "60000") || 60000,
    ),
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
