import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { BodyTooLargeError, readJsonBody } from "./edge-json-body.ts";
import {
  extractCronSecrets,
  isCronRequest,
} from "./cron-bearer-verify.ts";

/** Verificação rápida só via CRON_SECRET env (legado). */
export function isCronAuthenticatedEnv(req: Request): boolean {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return false;
  const { bearer, headerSecret } = extractCronSecrets(req);
  return bearer === secret || headerSecret === secret;
}

/** Cron via env CRON_SECRET ou bearer em retentio_ops_config. */
export async function isCronAuthenticated(
  req: Request,
  admin?: SupabaseClient,
): Promise<boolean> {
  if (isCronAuthenticatedEnv(req)) return true;
  if (!admin) return false;
  return isCronRequest(req, admin);
}

/** Utilizador JWT (não cron). */
export async function getJwtUserIdFromRequest(
  req: Request,
  admin?: SupabaseClient,
): Promise<string | null> {
  if (await isCronAuthenticated(req, admin)) return null;
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!authHeader.startsWith("Bearer ") || bearer.length < 10) return null;
  const secret = Deno.env.get("CRON_SECRET");
  if (secret && bearer === secret) return null;

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  return user?.id ?? null;
}

export type AgencyScopeResult =
  | { ok: true; agencyFilter?: string }
  | { ok: false; response: Response };

/**
 * Handlers com assertCronOrUser: cron pode filtrar por agency_id no POST;
 * utilizador JWT fica sempre restrito à própria agência (GET ou POST).
 */
export async function resolveCronDualAuthAgencyScope(
  req: Request,
  admin: SupabaseClient,
  corsHeaders: Record<string, string>,
): Promise<AgencyScopeResult> {
  const jsonHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json",
  };

  if (await isCronAuthenticated(req, admin)) {
    if (req.method === "POST") {
      try {
        const b = await readJsonBody(req);
        const aid = typeof b.agency_id === "string" ? b.agency_id.trim() : "";
        return { ok: true, agencyFilter: aid || undefined };
      } catch (e) {
        if (e instanceof BodyTooLargeError) {
          return {
            ok: false,
            response: new Response(
              JSON.stringify({ error: "payload demasiado grande" }),
              { status: 413, headers: jsonHeaders },
            ),
          };
        }
        return { ok: true };
      }
    }
    return { ok: true };
  }

  const uid = await getJwtUserIdFromRequest(req, admin);
  if (uid) {
    const { data: profile } = await admin
      .from("profiles")
      .select("agency_id")
      .eq("id", uid)
      .maybeSingle();
    if (!profile?.agency_id) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: "Sem permissão para este recurso" }),
          { status: 403, headers: jsonHeaders },
        ),
      };
    }
    return { ok: true, agencyFilter: profile.agency_id };
  }

  return {
    ok: false,
    response: new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: jsonHeaders,
    }),
  };
}

/** Bearer efectivo para invocar funções cron filhas (env ou DB). */
export async function resolveCronBearerForDispatch(
  admin: SupabaseClient,
): Promise<string | null> {
  const env = Deno.env.get("CRON_SECRET")?.trim();
  if (env && env.length >= 8) return env;
  const { data, error } = await admin.rpc("get_retentio_cron_bearer");
  if (error) {
    console.warn("[cron-scope] get_retentio_cron_bearer:", error.message);
    return null;
  }
  const bearer = typeof data === "string" ? data.trim() : "";
  return bearer.length >= 8 ? bearer : null;
}
