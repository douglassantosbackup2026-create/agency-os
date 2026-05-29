import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

let cachedDbBearer: string | null | undefined;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function extractCronSecrets(req: Request): {
  bearer: string;
  headerSecret: string;
} {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? "";
  return { bearer, headerSecret };
}

function envCronMatches(bearer: string, headerSecret: string): boolean {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return false;
  return bearer === secret || headerSecret === secret;
}

async function loadDbCronBearer(
  admin: SupabaseClient,
): Promise<string | null> {
  const now = Date.now();
  if (cachedDbBearer !== undefined && now - cachedAt < CACHE_TTL_MS) {
    return cachedDbBearer;
  }
  const { data, error } = await admin.rpc("get_retentio_cron_bearer");
  if (error) {
    console.warn("[cron-bearer] get_retentio_cron_bearer:", error.message);
    cachedDbBearer = null;
    cachedAt = now;
    return null;
  }
  const bearer = typeof data === "string" && data.length >= 8 ? data : null;
  cachedDbBearer = bearer;
  cachedAt = now;
  return bearer;
}

/** Cron secret (env ou retentio_ops_config) — usado por handlers privilegiados. */
export async function isCronRequest(
  req: Request,
  admin: SupabaseClient,
): Promise<boolean> {
  const { bearer, headerSecret } = extractCronSecrets(req);
  if (envCronMatches(bearer, headerSecret)) return true;

  const dbBearer = await loadDbCronBearer(admin);
  if (!dbBearer) return false;
  return bearer === dbBearer || headerSecret === dbBearer;
}
