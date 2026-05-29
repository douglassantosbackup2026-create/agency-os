import {
  handleCors,
  jsonResponse,
  corsHeaders,
} from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { signOAuthState } from "../_shared/diagnosis/state-signing.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";

function redirectUri(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/meta-oauth-callback`;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const traceId = traceIdFromRequest(req);
  if (req.method !== "GET")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const d = url.searchParams.get("d") ?? "";
  const s = url.searchParams.get("s") ?? "";

  const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
  if (!stateSecret || stateSecret.length < 16) {
    return jsonResponse({ error: "OAUTH_STATE_SECRET inválido" }, 500);
  }

  const sb = diagnosisServiceClient();
  const { data: row } = await sb
    .from("diagnoses")
    .select("id, secret_slug, status")
    .eq("id", d)
    .eq("secret_slug", s)
    .maybeSingle();

  if (!row) return jsonResponse({ error: "Diagnóstico não encontrado" }, 404);
  const st = row.status as string;
  if (st !== "awaiting_connection") {
    return jsonResponse(
      {
        error:
          "Só é possível conectar após confirmação do pagamento. Atualize a página em instantes.",
      },
      422,
    );
  }

  const appId = Deno.env.get("META_APP_ID")?.trim();
  if (!appId) return jsonResponse({ error: "META_APP_ID ausente" }, 500);

  const exp = Date.now() + 15 * 60 * 1000;
  const state = await signOAuthState(
    { diagnosisId: d, secret_slug: s, exp },
    stateSecret,
  );

  const scope = "ads_read";
  const fb = new URL(`https://www.facebook.com/v21.0/dialog/oauth`);
  fb.searchParams.set("client_id", appId);
  fb.searchParams.set("redirect_uri", redirectUri());
  fb.searchParams.set("scope", scope);
  fb.searchParams.set("state", state);
  fb.searchParams.set("response_type", "code");

  traceLog("meta_oauth_start.redirect", { diagnosis_id: d }, traceId);
  return new Response(null, {
    status: 302,
    headers: { Location: fb.toString(), ...corsHeaders },
  });
});
