// Estado das env vars OAuth globais (sem expor valores). Só platform admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function envOk(v: string | undefined, minLen = 1): boolean {
  return typeof v === "string" && v.trim().length >= minLen;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  const trace = beginEdgeTrace(req, "oauth_env_status");
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", u.user.id)
      .maybeSingle();
    if (!profile?.is_platform_admin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stateSecret = Deno.env.get("INTEGRATION_OAUTH_STATE_SECRET");
    const tikTokKey =
      Deno.env.get("TIKTOK_CLIENT_KEY") ?? Deno.env.get("TIKTOK_APP_ID");
    const tikTokSecret =
      Deno.env.get("TIKTOK_APP_SECRET") ?? Deno.env.get("TIKTOK_CLIENT_SECRET");

    const body = {
      integration_oauth_state_secret_ok:
        typeof stateSecret === "string" && stateSecret.length >= 16,
      public_site_url_ok:
        envOk(Deno.env.get("PUBLIC_SITE_URL")) ||
        envOk(Deno.env.get("SITE_URL")),
      meta_app_id_ok: envOk(Deno.env.get("META_APP_ID")),
      meta_app_secret_ok: envOk(Deno.env.get("META_APP_SECRET")),
      google_oauth_client_id_ok: envOk(Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")),
      google_oauth_client_secret_ok: envOk(
        Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET"),
      ),
      tiktok_client_or_app_id_ok: envOk(tikTokKey),
      tiktok_secret_ok: envOk(tikTokSecret),
    };

    trace.done({});
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    trace.fail(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
