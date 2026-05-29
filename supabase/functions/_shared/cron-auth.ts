/**
 * Cron + dashboard invocations for privileged functions.
 * - Production: define CRON_SECRET; cron sends Authorization: Bearer <CRON_SECRET> or x-cron-secret.
 * - Logged-in users may invoke with a normal Supabase JWT (Authorization: Bearer <session>).
 * - assertCronOrOwnerAdmin: JWT só owner/admin da agência.
 * - Without CRON_SECRET: requests are rejected unless ALLOW_INSECURE_CRON_ANON=true (local/dev only).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isCronRequest } from "./cron-bearer-verify.ts";

export function cronUnauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function assertCronOrUser(
  req: Request,
  admin?: SupabaseClient,
): Promise<Response | null> {
  const secret = Deno.env.get("CRON_SECRET");
  const allowInsecureAnon = Deno.env.get("ALLOW_INSECURE_CRON_ANON") === "true";
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const headerSecret = req.headers.get("x-cron-secret");

  if (secret && (bearer === secret || headerSecret === secret)) return null;
  if (admin && (await isCronRequest(req, admin))) return null;

  if (
    authHeader.startsWith("Bearer ") &&
    bearer.length > 10 &&
    bearer !== secret
  ) {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user) return null;
  }

  if (!secret) {
    if (allowInsecureAnon) {
      const anon = Deno.env.get("SUPABASE_ANON_KEY");
      const apikey = req.headers.get("apikey") ?? "";
      if (anon && apikey === anon) {
        console.warn(
          "[cron-auth] ALLOW_INSECURE_CRON_ANON=true: anon apikey aceite. Nunca em produção.",
        );
        return null;
      }
    }
    console.warn(
      "[cron-auth] CRON_SECRET ausente e modo inseguro desativado — pedido recusado.",
    );
    return cronUnauthorized();
  }

  return cronUnauthorized();
}

/** Cron secret ou utilizador JWT owner/admin (funções pesadas de agência). */
export async function assertCronOrOwnerAdmin(
  req: Request,
  admin: SupabaseClient,
): Promise<Response | null> {
  const secret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const headerSecret = req.headers.get("x-cron-secret");

  if (secret && (bearer === secret || headerSecret === secret)) return null;
  if (await isCronRequest(req, admin)) return null;

  if (
    authHeader.startsWith("Bearer ") &&
    bearer.length > 10 &&
    bearer !== secret
  ) {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user) {
      const { data: profile } = await admin
        .from("profiles")
        .select("agency_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.agency_id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("agency_id", profile.agency_id)
        .maybeSingle();
      if (roleRow && ["owner", "admin"].includes(String(roleRow.role))) {
        return null;
      }
      return new Response(
        JSON.stringify({ error: "Apenas owner/admin podem executar esta ação" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }
  }

  return assertCronOrUser(req, admin);
}
