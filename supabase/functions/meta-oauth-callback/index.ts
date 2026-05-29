import {
  handleCors,
  jsonResponse,
  corsHeaders,
} from "../_shared/diagnosis/cors.ts";
import { diagnosisServiceClient } from "../_shared/diagnosis/service.ts";
import { verifyOAuthState } from "../_shared/diagnosis/state-signing.ts";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
} from "../_shared/meta-graph-api.ts";
import {
  metaTestHarnessCallbackUrl,
  metaTestHarnessPageUrl,
  normalizePublicSiteUrl,
} from "../_shared/public-site-url.ts";
import { putMetaTestExchange } from "../_shared/meta-test-exchange.ts";
import { traceIdFromRequest, traceLog } from "../_shared/edge-trace.ts";

function siteUrl(): string {
  const raw = (
    Deno.env.get("PUBLIC_SITE_URL") ??
    Deno.env.get("SITE_URL") ??
    ""
  ).trim();
  // Strip leading garbage like ":" or stray characters before the scheme
  const cleaned = raw.replace(/^[^a-zA-Z]+/, "");
  const withProto = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  try {
    return new URL(withProto).origin;
  } catch {
    return cleaned.replace(/\/+$/, "");
  }
}

function redirectUri(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!.replace(/\/+$/, "");
  return `${supabaseUrl}/functions/v1/meta-oauth-callback`;
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
  const j = (await r.json()) as {
    data?: { id: string; account_id: string; name: string }[];
  };
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

type VerifiedState =
  | { kind: "meta_test"; payload: Record<string, unknown> }
  | { kind: "diagnosis"; payload: Record<string, unknown> };

async function verifyOAuthStateAny(
  stateRaw: string,
): Promise<VerifiedState | null> {
  const testSecret = Deno.env.get("META_TEST_OAUTH_STATE_SECRET")?.trim();
  if (testSecret && testSecret.length >= 16) {
    const testPayload = await verifyOAuthState(stateRaw, testSecret);
    if (testPayload?.purpose === "meta_test") {
      return { kind: "meta_test", payload: testPayload };
    }
  }

  const diagSecret = Deno.env.get("OAUTH_STATE_SECRET")?.trim();
  if (diagSecret && diagSecret.length >= 16) {
    const diagPayload = await verifyOAuthState(stateRaw, diagSecret);
    if (diagPayload) {
      return { kind: "diagnosis", payload: diagPayload };
    }
  }

  return null;
}

function metaTestReturnSite(payload: Record<string, unknown>): string {
  const fromState = normalizePublicSiteUrl(
    String(payload.return_site ?? ""),
  );
  if (fromState) return fromState;
  const site = normalizePublicSiteUrl(siteUrl());
  if (site) return site;
  return "http://localhost:5173";
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const traceId = traceIdFromRequest(req);
  if (req.method !== "GET")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const site = siteUrl();

  if (err) {
    const errParam = encodeURIComponent(err);
    if (site) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${site}/obrigado?oauth_error=${errParam}`,
          ...corsHeaders,
        },
      });
    }
    return jsonResponse({ error: err }, 400);
  }

  if (!code || !stateRaw) {
    return jsonResponse({ error: "code/state ausentes" }, 400);
  }

  const verified = await verifyOAuthStateAny(stateRaw);
  if (!verified) return jsonResponse({ error: "state inválido" }, 400);

  const exp = typeof verified.payload.exp === "number" ? verified.payload.exp : 0;
  if (Date.now() > exp) return jsonResponse({ error: "state expirado" }, 400);

  const redir = redirectUri();

  if (verified.kind === "meta_test") {
    const returnSite = metaTestReturnSite(verified.payload);

    const short = await exchangeCodeForToken(code, redir);
    if (!short.ok) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: metaTestHarnessPageUrl(returnSite, {
            oauth_error: short.error,
          }),
          ...corsHeaders,
        },
      });
    }

    const long = await exchangeForLongLivedToken(short.access_token);
    if (!long.ok) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: metaTestHarnessPageUrl(returnSite, {
            oauth_error: long.error,
          }),
          ...corsHeaders,
        },
      });
    }

    const expiresIn = long.expires_in ?? short.expires_in ?? 0;
    const exchangeCode = await putMetaTestExchange(
      long.access_token,
      expiresIn > 0 ? expiresIn : 3600,
    );
    const cb = new URL(metaTestHarnessCallbackUrl(returnSite));
    cb.searchParams.set("exchange_code", exchangeCode);

    return new Response(null, {
      status: 302,
      headers: { Location: cb.toString(), ...corsHeaders },
    });
  }

  if (!site) return jsonResponse({ error: "PUBLIC_SITE_URL ausente" }, 500);

  const diagnosisId = String(verified.payload.diagnosisId ?? "");
  const secretSlug = String(verified.payload.secret_slug ?? "");

  const short = await exchangeCodeForToken(code, redir);
  if (!short.ok) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${site}/obrigado?d=${diagnosisId}&s=${secretSlug}&oauth_error=token`,
        ...corsHeaders,
      },
    });
  }

  const long = await exchangeForLongLivedToken(short.access_token);
  if (!long.ok) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${site}/obrigado?d=${diagnosisId}&s=${secretSlug}&oauth_error=token`,
        ...corsHeaders,
      },
    });
  }

  const userToken = long.access_token;
  const accounts = await fetchAdAccounts(userToken);
  const first = accounts[0];
  if (!first) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `${site}/obrigado?d=${diagnosisId}&s=${secretSlug}&oauth_error=noadaccounts`,
        ...corsHeaders,
      },
    });
  }

  const actId = first.id.startsWith("act_")
    ? first.id
    : `act_${first.account_id}`;
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

  traceLog("meta_oauth_callback.ok", { diagnosis_id: diagnosisId }, traceId);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${site}/obrigado?d=${diagnosisId}&s=${secretSlug}&step=processing`,
      ...corsHeaders,
    },
  });
});
