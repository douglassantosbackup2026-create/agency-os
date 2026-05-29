// Dev-only harness: Meta OAuth + Graph API proxy for /test-meta-oauth.
// Secrets: Supabase Edge Secrets ou dev_config no body (formulário /test-meta-oauth).
import { BodyTooLargeError, readJsonBody } from "../_shared/edge-json-body.ts";
import {
  buildMetaOAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchAdAccounts,
  fetchAdSets,
  fetchAds,
  fetchCampaigns,
  fetchInsights,
  type MetaGraphEnv,
} from "../_shared/meta-graph-api.ts";
import {
  signOAuthState,
  verifyOAuthState,
} from "../_shared/diagnosis/state-signing.ts";
import { normalizePublicSiteUrl } from "../_shared/public-site-url.ts";
import { takeMetaTestExchange } from "../_shared/meta-test-exchange.ts";
import { beginEdgeTrace } from "../_shared/edge-trace-handler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type DevConfig = {
  meta_test_enabled?: string;
  meta_test_oauth_state_secret?: string;
  meta_app_id?: string;
  meta_app_secret?: string;
  public_site_url?: string;
  meta_api_version?: string;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseDevConfig(body: Record<string, unknown>): DevConfig | undefined {
  const dc = body.dev_config;
  if (!dc || typeof dc !== "object" || Array.isArray(dc)) return undefined;
  return dc as DevConfig;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function graphEnvFromBody(body: Record<string, unknown>): MetaGraphEnv {
  const dc = parseDevConfig(body);
  return {
    metaAppId: str(dc?.meta_app_id) || undefined,
    metaAppSecret: str(dc?.meta_app_secret) || undefined,
    metaApiVersion: str(dc?.meta_api_version) || undefined,
  };
}

function isHarnessEnabled(body: Record<string, unknown>): boolean {
  if (Deno.env.get("META_TEST_ENABLED") === "true") return true;
  const dc = parseDevConfig(body);
  return str(dc?.meta_test_enabled) === "true";
}

function assertHarnessEnabled(body: Record<string, unknown>): Response | null {
  if (!isHarnessEnabled(body)) {
    return json(
      {
        error:
          "Harness desactivado. Defina META_TEST_ENABLED=true no Supabase ou no formulário de secrets.",
      },
      403,
    );
  }
  return null;
}

function supabaseMetaOAuthCallbackUri(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL ausente");
  }
  return `${supabaseUrl}/functions/v1/meta-oauth-callback`;
}

function resolveMetaOAuthRedirectUri(body: Record<string, unknown>): string {
  const requested = str(body.redirect_uri);
  const canonical = supabaseMetaOAuthCallbackUri();
  if (!requested || requested === canonical) return canonical;
  return requested;
}

function assertMetaOAuthRedirectUri(redirectUri: string): Response | null {
  const canonical = supabaseMetaOAuthCallbackUri();
  if (redirectUri !== canonical) {
    return json(
      {
        error: `redirect_uri deve ser ${canonical}`,
      },
      400,
    );
  }
  return null;
}

function frontendReturnSite(body: Record<string, unknown>): string {
  const dc = parseDevConfig(body);
  const raw =
    str(dc?.public_site_url) ||
    Deno.env.get("PUBLIC_SITE_URL")?.trim() ||
    Deno.env.get("SITE_URL")?.trim() ||
    "http://localhost:5173";
  return normalizePublicSiteUrl(raw) || "http://localhost:5173";
}

function stateSecret(body: Record<string, unknown>): string | Response {
  const dc = parseDevConfig(body);
  const secret =
    Deno.env.get("META_TEST_OAUTH_STATE_SECRET")?.trim() ||
    str(dc?.meta_test_oauth_state_secret);
  if (!secret || secret.length < 16) {
    return json(
      {
        error:
          "META_TEST_OAUTH_STATE_SECRET em falta ou < 16 caracteres (Supabase ou formulário).",
      },
      422,
    );
  }
  return secret;
}

function requireAccessToken(body: Record<string, unknown>): string | Response {
  const token = str(body.access_token);
  if (!token) {
    return json({ error: "access_token é obrigatório" }, 400);
  }
  return token;
}

function resolveSecret(
  envKey: string,
  devValue: string | undefined,
): { value: string; from: "env" | "dev_config" } {
  const env = Deno.env.get(envKey)?.trim() ?? "";
  if (env) return { value: env, from: "env" };
  const dev = devValue?.trim() ?? "";
  if (dev) return { value: dev, from: "dev_config" };
  return { value: "", from: "dev_config" };
}

function checkSecrets(body: Record<string, unknown>) {
  const dc = parseDevConfig(body);
  const fields = {
    META_TEST_ENABLED: resolveSecret(
      "META_TEST_ENABLED",
      dc?.meta_test_enabled,
    ),
    META_TEST_OAUTH_STATE_SECRET: resolveSecret(
      "META_TEST_OAUTH_STATE_SECRET",
      dc?.meta_test_oauth_state_secret,
    ),
    META_APP_ID: resolveSecret("META_APP_ID", dc?.meta_app_id),
    META_APP_SECRET: resolveSecret("META_APP_SECRET", dc?.meta_app_secret),
    PUBLIC_SITE_URL: resolveSecret("PUBLIC_SITE_URL", dc?.public_site_url),
  };

  const configured: Record<string, boolean> = {};
  const missing: string[] = [];
  let hasEnv = false;
  let hasDev = false;

  for (const [key, { value, from }] of Object.entries(fields)) {
    if (from === "env") hasEnv = true;
    if (from === "dev_config" && value) hasDev = true;
    if (key === "META_TEST_OAUTH_STATE_SECRET") {
      configured[key] = value.length >= 16;
    } else if (key === "META_TEST_ENABLED") {
      configured[key] = value === "true";
    } else {
      configured[key] = value.length > 0;
    }
    if (!configured[key]) missing.push(key);
  }

  const source: "env" | "dev_config" | "mixed" =
    hasEnv && hasDev ? "mixed" : hasEnv ? "env" : "dev_config";

  return {
    harness_enabled: configured.META_TEST_ENABLED === true,
    configured,
    missing,
    source,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const trace = beginEdgeTrace(req, "meta_api_test");

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return json({ error: "Payload demasiado grande" }, 413);
    }
    return json({ error: "Body inválido" }, 400);
  }

  const action = str(body.action);
  console.log("[meta-api-test] action=", action);

  if (action === "check_secrets") {
    return json(checkSecrets(body));
  }

  const disabled = assertHarnessEnabled(body);
  if (disabled) return disabled;

  const gEnv = graphEnvFromBody(body);

  if (action === "start") {
    const redirectUri = resolveMetaOAuthRedirectUri(body);
    const redirectInvalid = assertMetaOAuthRedirectUri(redirectUri);
    if (redirectInvalid) return redirectInvalid;
    const secretCheck = stateSecret(body);
    if (secretCheck instanceof Response) return secretCheck;

    const returnSite = frontendReturnSite(body);
    const state = await signOAuthState(
      {
        purpose: "meta_test",
        exp: Date.now() + 15 * 60 * 1000,
        return_site: returnSite,
      },
      secretCheck,
    );
    const urlResult = buildMetaOAuthUrl(redirectUri, state, gEnv);
    if (typeof urlResult !== "string") {
      return json({ error: urlResult.error }, 500);
    }
    return json({ oauth_url: urlResult, state });
  }

  if (action === "redeem_exchange") {
    const code = str(body.exchange_code);
    if (!code) return json({ error: "exchange_code é obrigatório" }, 400);
    const entry = await takeMetaTestExchange(code);
    if (!entry) return json({ error: "exchange_code inválido ou expirado" }, 400);
    return json({
      access_token: entry.access_token,
      expires_in: entry.expires_in,
    });
  }

  if (action === "exchange") {
    const redirectUri = resolveMetaOAuthRedirectUri(body);
    const redirectInvalid = assertMetaOAuthRedirectUri(redirectUri);
    if (redirectInvalid) return redirectInvalid;
    const secretCheck = stateSecret(body);
    if (secretCheck instanceof Response) return secretCheck;

    const code = str(body.code);
    const stateRaw = str(body.state);
    if (!code || !stateRaw) {
      return json({ error: "code e state são obrigatórios" }, 400);
    }

    const payload = await verifyOAuthState(stateRaw, secretCheck);
    if (!payload) return json({ error: "state inválido" }, 400);
    const exp = typeof payload.exp === "number" ? payload.exp : 0;
    if (Date.now() > exp) return json({ error: "state expirado" }, 400);

    const short = await exchangeCodeForToken(code, redirectUri, gEnv);
    if (!short.ok) return json({ error: short.error }, 400);

    const long = await exchangeForLongLivedToken(short.access_token, gEnv);
    if (!long.ok) return json({ error: long.error }, 400);

    return json({
      access_token: long.access_token,
      expires_in: long.expires_in ?? short.expires_in,
    });
  }

  if (action === "long_lived") {
    const tokenCheck = requireAccessToken(body);
    if (tokenCheck instanceof Response) return tokenCheck;
    const long = await exchangeForLongLivedToken(tokenCheck, gEnv);
    if (!long.ok) return json({ error: long.error }, 400);
    return json({
      access_token: long.access_token,
      expires_in: long.expires_in,
    });
  }

  if (action === "adaccounts") {
    const tokenCheck = requireAccessToken(body);
    if (tokenCheck instanceof Response) return tokenCheck;
    const result = await fetchAdAccounts(tokenCheck, gEnv);
    if (!result.ok) return json({ error: result.error }, 400);
    return json({ data: result.data, raw: result.raw });
  }

  if (action === "campaigns") {
    const tokenCheck = requireAccessToken(body);
    if (tokenCheck instanceof Response) return tokenCheck;
    const adAccountId = str(body.ad_account_id);
    if (!adAccountId) {
      return json({ error: "ad_account_id é obrigatório" }, 400);
    }
    const result = await fetchCampaigns(tokenCheck, adAccountId, gEnv);
    if (!result.ok) return json({ error: result.error }, 400);
    return json({ data: result.data, raw: result.raw });
  }

  if (action === "insights") {
    const tokenCheck = requireAccessToken(body);
    if (tokenCheck instanceof Response) return tokenCheck;
    const adAccountId = str(body.ad_account_id);
    if (!adAccountId) {
      return json({ error: "ad_account_id é obrigatório" }, 400);
    }
    const days =
      typeof body.days === "number" && body.days > 0
        ? body.days
        : Number(body.days) || 90;
    const result = await fetchInsights(tokenCheck, adAccountId, days, gEnv);
    if (!result.ok) return json({ error: result.error }, 400);
    return json({ data: result.data, raw: result.raw });
  }

  if (action === "adsets") {
    const tokenCheck = requireAccessToken(body);
    if (tokenCheck instanceof Response) return tokenCheck;
    const campaignId = str(body.campaign_id);
    if (!campaignId) {
      return json({ error: "campaign_id é obrigatório" }, 400);
    }
    const result = await fetchAdSets(tokenCheck, campaignId, gEnv);
    if (!result.ok) return json({ error: result.error }, 400);
    return json({ data: result.data, raw: result.raw });
  }

  if (action === "ads") {
    const tokenCheck = requireAccessToken(body);
    if (tokenCheck instanceof Response) return tokenCheck;
    const adSetId = str(body.adset_id);
    if (!adSetId) {
      return json({ error: "adset_id é obrigatório" }, 400);
    }
    const result = await fetchAds(tokenCheck, adSetId, gEnv);
    if (!result.ok) return json({ error: result.error }, 400);
    return json({ data: result.data, raw: result.raw });
  }

  return json({ error: `action desconhecida: ${action || "(vazia)"}` }, 400);
});
