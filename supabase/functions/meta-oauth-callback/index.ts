import { handleCors, jsonResponse, corsHeaders } from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { verifyOAuthState } from "../_shared/diagnosis/state-signing.ts";

function siteUrl(): string {
  return (
    Deno.env.get("PUBLIC_SITE_URL") ??
    Deno.env.get("SITE_URL") ??
    ""
  ).replace(/\/+$/, "");
}

function redirectUri(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/meta-oauth-callback`;
}

async function exchangeCode(code: string): Promise<{
  access_token: string;
  expires_in?: number;
} | null> {
  const appId = Deno.env.get("META_APP_ID")!;
  const secret = Deno.env.get("META_APP_SECRET")!;
  const u = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("client_secret", secret);
  u.searchParams.set("code", code);
  const r = await fetch(u.toString());
  if (!r.ok) {
    console.error(await r.text());
    return null;
  }
  return (await r.json()) as { access_token: string; expires_in?: number };
}

async function longLivedToken(shortToken: string): Promise<string> {
  const appId = Deno.env.get("META_APP_ID")!;
  const secret = Deno.env.get("META_APP_SECRET")!;
  const u = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
  u.searchParams.set("grant_type", "fb_exchange_token");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("client_secret", secret);
  u.searchParams.set("fb_exchange_token", shortToken);
  const r = await fetch(u.toString());
  if (!r.ok) return shortToken;
  const j = (await r.json()) as { access_token?: string };
  return j.access_token ?? shortToken;
}

async function fetchAdAccounts(
  userToken: string,
): Promise<{ id: string; account_id: string; name: string }[]> {
  const u = new URL("https://graph.facebook.com/v21.0/me/adaccounts");
  u.searchParams.set("fields", "id,account_id,name");
  u.searchParams.set("access_token", userToken);
  const r = await fetch(u.toString());
  if (!r.ok) {
    console.error(await r.text());
    return [];
  }
  const j = (await r.json()) as { data?: { id: string; account_id: string; name: string }[] };
  return j.data ?? [];
}

async function triggerProcess(): Promise<void> {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) return;
  const base = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  await fetch(`${base}/functions/v1/process-diagnosis`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  }).catch(() => undefined);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const site = siteUrl();
  if (!site) return jsonResponse({ error: "PUBLIC_SITE_URL ausente" }, 500);

  if (err) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${site}/obrigado?oauth_error=${encodeURIComponent(err)}`,
        ...corsHeaders,
      },
    });
  }
  if (!code || !stateRaw) {
    return jsonResponse({ error: "code/state ausentes" }, 400);
  }

  const stateSecret = Deno.env.get("OAUTH_STATE_SECRET");
  if (!stateSecret) return jsonResponse({ error: "OAUTH_STATE_SECRET ausente" }, 500);

  const payload = await verifyOAuthState(stateRaw, stateSecret);
  if (!payload) return jsonResponse({ error: "state inválido" }, 400);
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  if (Date.now() > exp) return jsonResponse({ error: "state expirado" }, 400);

  const diagnosisId = String(payload.diagnosisId ?? "");
  const secretSlug = String(payload.secret_slug ?? "");

  const short = await exchangeCode(code);
  if (!short?.access_token) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${site}/obrigado?d=${diagnosisId}&s=${secretSlug}&oauth_error=token`,
        ...corsHeaders,
      },
    });
  }

  const userToken = await longLivedToken(short.access_token);
  const accounts = await fetchAdAccounts(userToken);
  const first = accounts[0];
  if (!first) {
    return new Response(null, {
      status: 302,
      headers: {
        Location:
          `${site}/obrigado?d=${diagnosisId}&s=${secretSlug}&oauth_error=noadaccounts`,
        ...corsHeaders,
      },
    });
  }

  const actId = first.id.startsWith("act_") ? first.id : `act_${first.account_id}`;
  const expiresAt = short.expires_in
    ? new Date(Date.now() + short.expires_in * 1000).toISOString()
    : null;

  const sb = diagnosisServiceClient();
  const { error: e1 } = await sb.from("diagnosis_secrets").upsert({
    diagnosis_id: diagnosisId,
    access_token: userToken,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  if (e1) {
    console.error(e1);
    return jsonResponse({ error: "Falha ao guardar token" }, 500);
  }

  const { error: e2 } = await sb
    .from("diagnoses")
    .update({
      meta_ad_account_id: actId,
      status: "processing",
    })
    .eq("id", diagnosisId)
    .eq("secret_slug", secretSlug);

  if (e2) {
    console.error(e2);
    return jsonResponse({ error: "Falha ao atualizar diagnóstico" }, 500);
  }

  await triggerProcess();

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${site}/obrigado?d=${diagnosisId}&s=${secretSlug}&step=processing`,
      ...corsHeaders,
    },
  });
});
