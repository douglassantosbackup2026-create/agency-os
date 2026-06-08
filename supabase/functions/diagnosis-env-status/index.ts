// Secrets do funil Diagnóstico Meta (sem expor valores). Só platform admin.
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";
import { assertPlatformAdmin } from "../_shared/assert-platform-admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function envOk(v: string | undefined, minLen = 1): boolean {
  return typeof v === "string" && v.trim().length >= minLen;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const trace = beginEdgeTrace(req, "diagnosis_env_status");
  try {
    const gate = await assertPlatformAdmin(req.headers.get("Authorization"));
    if (!gate.ok) {
      return new Response(JSON.stringify({ error: gate.message }), {
        status: gate.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oauthState =
      Deno.env.get("OAUTH_STATE_SECRET") ??
      Deno.env.get("META_TEST_OAUTH_STATE_SECRET");

    const body = {
      public_site_url_ok:
        envOk(Deno.env.get("PUBLIC_SITE_URL")) ||
        envOk(Deno.env.get("SITE_URL")),
      mercadopago_access_token_ok: envOk(
        Deno.env.get("MERCADOPAGO_ACCESS_TOKEN"),
      ),
      mercadopago_webhook_secret_ok: envOk(
        Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET"),
        8,
      ),
      mercadopago_public_key_ok: envOk(Deno.env.get("MERCADOPAGO_PUBLIC_KEY")),
      meta_app_id_ok: envOk(Deno.env.get("META_APP_ID")),
      meta_app_secret_ok: envOk(Deno.env.get("META_APP_SECRET")),
      oauth_state_secret_ok: envOk(oauthState, 16),
      cron_secret_ok: envOk(Deno.env.get("CRON_SECRET"), 8),
      anthropic_api_key_ok: envOk(Deno.env.get("ANTHROPIC_API_KEY")),
      gemini_api_key_ok: envOk(Deno.env.get("GEMINI_API_KEY")),
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
