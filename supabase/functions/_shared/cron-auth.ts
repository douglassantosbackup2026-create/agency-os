/**
 * Cron + dashboard invocations for privileged functions.
 * - Production: define CRON_SECRET; cron sends Authorization: Bearer <CRON_SECRET> or x-cron-secret.
 * - Logged-in users may invoke with a normal Supabase JWT (Authorization: Bearer <session>).
 * - Without CRON_SECRET: requests are rejected unless ALLOW_INSECURE_CRON_ANON=true (local/dev only).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export function cronUnauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function assertCronOrUser(req: Request): Promise<Response | null> {
  const secret = Deno.env.get("CRON_SECRET");
  const allowInsecureAnon = Deno.env.get("ALLOW_INSECURE_CRON_ANON") === "true";
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const headerSecret = req.headers.get("x-cron-secret");

  if (secret && (bearer === secret || headerSecret === secret)) return null;

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
