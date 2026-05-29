import type {
  Ad,
  AdAccount,
  AdSet,
  Campaign,
  Insights,
  MetaOAuthTokenResponse,
  MetaTestSecretsCheckResponse,
  MetaTestSecretsConfig,
  MetaTestStartResponse,
} from "@/types/meta";

const FALLBACK_SUPABASE_URL = "https://uvuotaxikuxejfeitlaw.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2dW90YXhpa3V4ZWpmZWl0bGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzk4MjcsImV4cCI6MjA5Mzg1NTgyN30.32xOultMJNFLQ98Nw3VxQR5t5wyEH1NxTyg6K_bMl_s";

function resolveSupabaseUrl(): string {
  const isProd = import.meta.env.PROD;
  const env = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const url = env || (!isProd ? FALLBACK_SUPABASE_URL : "");
  if (!url) {
    throw new Error(
      "VITE_SUPABASE_URL é obrigatório em produção.",
    );
  }
  return url;
}

function resolvePublishableKey(): string {
  const isProd = import.meta.env.PROD;
  const env = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const key = env || (!isProd ? FALLBACK_SUPABASE_PUBLISHABLE_KEY : "");
  if (!key) {
    throw new Error(
      "VITE_SUPABASE_PUBLISHABLE_KEY é obrigatório em produção.",
    );
  }
  return key;
}

const STORAGE_PREFIX = "meta_test_";

export const META_TEST_STORAGE_KEYS = {
  accessToken: `${STORAGE_PREFIX}access_token`,
  expiresAt: `${STORAGE_PREFIX}expires_at`,
  selectedAdAccountId: `${STORAGE_PREFIX}selected_ad_account_id`,
  selectedCampaignId: `${STORAGE_PREFIX}selected_campaign_id`,
  selectedAdSetId: `${STORAGE_PREFIX}selected_adset_id`,
  lastJsonResult: `${STORAGE_PREFIX}last_json_result`,
  lastResultType: `${STORAGE_PREFIX}last_result_type`,
  secretsConfig: `${STORAGE_PREFIX}secrets_config`,
} as const;

export const META_TEST_SECRET_FIELDS = [
  {
    key: "meta_test_enabled" as const,
    envName: "META_TEST_ENABLED",
    label: "META_TEST_ENABLED",
    placeholder: "true",
    type: "text" as const,
    hint: "Deve ser true para activar o harness.",
  },
  {
    key: "meta_test_oauth_state_secret" as const,
    envName: "META_TEST_OAUTH_STATE_SECRET",
    label: "META_TEST_OAUTH_STATE_SECRET",
    placeholder: "string com 16+ caracteres",
    type: "password" as const,
    hint: "Segredo HMAC para o state OAuth (mínimo 16 chars).",
  },
  {
    key: "meta_app_id" as const,
    envName: "META_APP_ID",
    label: "META_APP_ID",
    placeholder: "ID da app Meta",
    type: "text" as const,
    hint: "App ID em developers.facebook.com.",
  },
  {
    key: "meta_app_secret" as const,
    envName: "META_APP_SECRET",
    label: "META_APP_SECRET",
    placeholder: "Secret da app Meta",
    type: "password" as const,
    hint: "Nunca commitar — só localStorage dev ou Supabase Secrets.",
  },
  {
    key: "public_site_url" as const,
    envName: "PUBLIC_SITE_URL",
    label: "PUBLIC_SITE_URL",
    placeholder: "http://localhost:5173",
    type: "text" as const,
    hint: "Só a origem (ex.: http://localhost:8080), sem /test-meta-oauth.",
  },
] as const;

/** Origem do frontend (sem path). Evita redirects duplicados /test-meta-oauth/test-meta-oauth. */
export function normalizePublicSiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;
    return new URL(withProto).origin;
  } catch {
    return trimmed
      .replace(/\/+$/, "")
      .replace(/\/test-meta-oauth.*$/i, "");
  }
}

export function defaultMetaTestSecrets(): MetaTestSecretsConfig {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return {
    meta_test_enabled: "true",
    meta_test_oauth_state_secret: "",
    meta_app_id: "",
    meta_app_secret: "",
    public_site_url: origin || "http://localhost:5173",
    meta_api_version: "v21.0",
  };
}

export type MetaTestStoredSession = {
  accessToken: string | null;
  expiresAt: number | null;
  selectedAdAccountId: string | null;
  selectedCampaignId: string | null;
  selectedAdSetId: string | null;
};

function edgeFunctionUrl(): string {
  return `${resolveSupabaseUrl()}/functions/v1/meta-api-test`;
}

function publishableKey(): string {
  return resolvePublishableKey();
}

export function metaOAuthRedirectUri(): string {
  return `${resolveSupabaseUrl()}/functions/v1/meta-oauth-callback`;
}

/** URL do frontend para receber o token após meta-oauth-callback (redirect interno). */
export function metaTestFrontendCallbackUri(): string {
  const cfg = loadMetaTestSecrets();
  const site = normalizePublicSiteUrl(
    cfg.public_site_url ||
      import.meta.env.VITE_PUBLIC_SITE_URL ||
      import.meta.env.VITE_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : ""),
  );
  if (!site) {
    throw new Error(
      "Defina PUBLIC_SITE_URL no formulário ou VITE_PUBLIC_SITE_URL no .env",
    );
  }
  return new URL("/test-meta-oauth/callback", site).toString();
}

/** @deprecated Use metaOAuthRedirectUri() para Meta e metaTestFrontendCallbackUri() para o SPA. */
export function metaTestCallbackUri(): string {
  return metaOAuthRedirectUri();
}

export function loadMetaTestSecrets(): MetaTestSecretsConfig {
  if (typeof window === "undefined") return defaultMetaTestSecrets();
  try {
    const raw = localStorage.getItem(META_TEST_STORAGE_KEYS.secretsConfig);
    if (!raw) return defaultMetaTestSecrets();
    const parsed = JSON.parse(raw) as Partial<MetaTestSecretsConfig>;
    const merged = { ...defaultMetaTestSecrets(), ...parsed };
    merged.public_site_url = normalizePublicSiteUrl(merged.public_site_url);
    return merged;
  } catch {
    return defaultMetaTestSecrets();
  }
}

export function saveMetaTestSecrets(config: MetaTestSecretsConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    META_TEST_STORAGE_KEYS.secretsConfig,
    JSON.stringify({
      ...config,
      public_site_url: normalizePublicSiteUrl(config.public_site_url),
    }),
  );
}

export function clearMetaTestSecrets(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(META_TEST_STORAGE_KEYS.secretsConfig);
}

export function buildDevConfigPayload(
  config?: MetaTestSecretsConfig,
): Record<string, string> {
  const c = config ?? loadMetaTestSecrets();
  return {
    meta_test_enabled: c.meta_test_enabled,
    meta_test_oauth_state_secret: c.meta_test_oauth_state_secret,
    meta_app_id: c.meta_app_id,
    meta_app_secret: c.meta_app_secret,
    public_site_url: normalizePublicSiteUrl(c.public_site_url),
    meta_api_version: c.meta_api_version ?? "v21.0",
  };
}

export function buildSupabaseSecretsCli(
  config?: MetaTestSecretsConfig,
): string {
  const c = config ?? loadMetaTestSecrets();
  const lines = [
    `supabase secrets set META_TEST_ENABLED=${c.meta_test_enabled}`,
    `supabase secrets set META_TEST_OAUTH_STATE_SECRET="${c.meta_test_oauth_state_secret}"`,
    `supabase secrets set META_APP_ID=${c.meta_app_id}`,
    `supabase secrets set META_APP_SECRET="${c.meta_app_secret}"`,
    `supabase secrets set PUBLIC_SITE_URL=${c.public_site_url}`,
  ];
  if (c.meta_api_version) {
    lines.push(`supabase secrets set META_API_VERSION=${c.meta_api_version}`);
  }
  return lines.join("\n");
}

export function validateMetaTestSecretsLocal(
  config: MetaTestSecretsConfig,
): string[] {
  const missing: string[] = [];
  if (config.meta_test_enabled !== "true") missing.push("META_TEST_ENABLED");
  if (config.meta_test_oauth_state_secret.trim().length < 16) {
    missing.push("META_TEST_OAUTH_STATE_SECRET (min. 16 chars)");
  }
  if (!config.meta_app_id.trim()) missing.push("META_APP_ID");
  if (!config.meta_app_secret.trim()) missing.push("META_APP_SECRET");
  if (!config.public_site_url.trim()) missing.push("PUBLIC_SITE_URL");
  return missing;
}

export function parseMetaError(body: unknown, status: number): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error: unknown }).error;
    if (typeof err === "string" && err.trim()) return err;
    if (err && typeof err === "object" && "message" in err) {
      return String((err as { message: unknown }).message);
    }
  }
  return `Pedido falhou (HTTP ${status})`;
}

async function invokeMetaTest<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const url = edgeFunctionUrl();
  const dev_config = buildDevConfigPayload();
  const requestBody = { action, dev_config, ...payload };
  console.log(`[meta-api-test] invoke action=${action}`, {
    ...requestBody,
    dev_config: {
      ...dev_config,
      meta_app_secret: dev_config.meta_app_secret ? "[redacted]" : "",
      meta_test_oauth_state_secret: dev_config.meta_test_oauth_state_secret
        ? "[redacted]"
        : "",
    },
  });

  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: publishableKey(),
    },
    body: JSON.stringify(requestBody),
  });

  let body: unknown;
  try {
    body = await r.json();
  } catch {
    body = null;
  }

  if (!r.ok) {
    const msg = parseMetaError(body, r.status);
    console.error(`[meta-api-test] erro action=${action}:`, msg, body);
    throw new Error(msg);
  }

  console.log(`[meta-api-test] ok action=${action}`, body);
  return body as T;
}

export async function checkMetaTestSecrets(
  config?: MetaTestSecretsConfig,
): Promise<MetaTestSecretsCheckResponse> {
  const dev_config = buildDevConfigPayload(config);
  return invokeMetaTest<MetaTestSecretsCheckResponse>("check_secrets", {
    dev_config,
  });
}

export async function generateMetaOAuthURL(): Promise<string> {
  const redirectUri = metaOAuthRedirectUri();
  console.log("[meta-api-test] generateMetaOAuthURL", redirectUri);
  const res = await invokeMetaTest<MetaTestStartResponse>("start", {
    redirect_uri: redirectUri,
  });
  if (!res.oauth_url) {
    throw new Error("Resposta start sem oauth_url");
  }
  return res.oauth_url;
}

export async function redeemMetaTestExchange(
  exchangeCode: string,
): Promise<MetaOAuthTokenResponse> {
  return invokeMetaTest<MetaOAuthTokenResponse>("redeem_exchange", {
    exchange_code: exchangeCode,
  });
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  state: string,
): Promise<MetaOAuthTokenResponse> {
  console.log("[meta-api-test] exchangeCodeForToken");
  return invokeMetaTest<MetaOAuthTokenResponse>("exchange", {
    code,
    redirect_uri: redirectUri,
    state,
  });
}

export async function exchangeForLongLivedToken(
  shortToken: string,
): Promise<{ access_token: string; expires_in?: number }> {
  console.log("[meta-api-test] exchangeForLongLivedToken");
  return invokeMetaTest<{ access_token: string; expires_in?: number }>(
    "long_lived",
    { access_token: shortToken },
  );
}

export async function getAdAccounts(accessToken: string): Promise<AdAccount[]> {
  console.log("[meta-api-test] getAdAccounts");
  const res = await invokeMetaTest<{ data: AdAccount[] }>("adaccounts", {
    access_token: accessToken,
  });
  return (res.data ?? []) as AdAccount[];
}

export async function getCampaigns(
  accessToken: string,
  adAccountId: string,
): Promise<Campaign[]> {
  console.log("[meta-api-test] getCampaigns", adAccountId);
  const res = await invokeMetaTest<{ data: Campaign[] }>("campaigns", {
    access_token: accessToken,
    ad_account_id: adAccountId,
  });
  return (res.data ?? []) as Campaign[];
}

export async function getInsights(
  accessToken: string,
  adAccountId: string,
  days = 90,
): Promise<Insights> {
  console.log("[meta-api-test] getInsights", adAccountId, days);
  const res = await invokeMetaTest<{ data: Insights }>("insights", {
    access_token: accessToken,
    ad_account_id: adAccountId,
    days,
  });
  return res.data as Insights;
}

export async function getAdSets(
  accessToken: string,
  campaignId: string,
): Promise<AdSet[]> {
  console.log("[meta-api-test] getAdSets", campaignId);
  const res = await invokeMetaTest<{ data: AdSet[] }>("adsets", {
    access_token: accessToken,
    campaign_id: campaignId,
  });
  return (res.data ?? []) as AdSet[];
}

export async function getAds(
  accessToken: string,
  adSetId: string,
): Promise<Ad[]> {
  console.log("[meta-api-test] getAds", adSetId);
  const res = await invokeMetaTest<{ data: Ad[] }>("ads", {
    access_token: accessToken,
    adset_id: adSetId,
  });
  return (res.data ?? []) as Ad[];
}

export function loadMetaTestSession(): MetaTestStoredSession {
  if (typeof window === "undefined") {
    return {
      accessToken: null,
      expiresAt: null,
      selectedAdAccountId: null,
      selectedCampaignId: null,
      selectedAdSetId: null,
    };
  }
  const expiresRaw = localStorage.getItem(META_TEST_STORAGE_KEYS.expiresAt);
  return {
    accessToken: localStorage.getItem(META_TEST_STORAGE_KEYS.accessToken),
    expiresAt: expiresRaw ? Number(expiresRaw) : null,
    selectedAdAccountId: localStorage.getItem(
      META_TEST_STORAGE_KEYS.selectedAdAccountId,
    ),
    selectedCampaignId: localStorage.getItem(
      META_TEST_STORAGE_KEYS.selectedCampaignId,
    ),
    selectedAdSetId: localStorage.getItem(
      META_TEST_STORAGE_KEYS.selectedAdSetId,
    ),
  };
}

export function saveMetaTestToken(
  accessToken: string,
  expiresInSeconds?: number,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(META_TEST_STORAGE_KEYS.accessToken, accessToken);
  if (expiresInSeconds && expiresInSeconds > 0) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(META_TEST_STORAGE_KEYS.expiresAt, String(expiresAt));
  } else {
    localStorage.removeItem(META_TEST_STORAGE_KEYS.expiresAt);
  }
}

export function saveMetaTestSelection(partial: {
  selectedAdAccountId?: string | null;
  selectedCampaignId?: string | null;
  selectedAdSetId?: string | null;
}): void {
  if (typeof window === "undefined") return;
  if (partial.selectedAdAccountId !== undefined) {
    if (partial.selectedAdAccountId) {
      localStorage.setItem(
        META_TEST_STORAGE_KEYS.selectedAdAccountId,
        partial.selectedAdAccountId,
      );
    } else {
      localStorage.removeItem(META_TEST_STORAGE_KEYS.selectedAdAccountId);
    }
  }
  if (partial.selectedCampaignId !== undefined) {
    if (partial.selectedCampaignId) {
      localStorage.setItem(
        META_TEST_STORAGE_KEYS.selectedCampaignId,
        partial.selectedCampaignId,
      );
    } else {
      localStorage.removeItem(META_TEST_STORAGE_KEYS.selectedCampaignId);
    }
  }
  if (partial.selectedAdSetId !== undefined) {
    if (partial.selectedAdSetId) {
      localStorage.setItem(
        META_TEST_STORAGE_KEYS.selectedAdSetId,
        partial.selectedAdSetId,
      );
    } else {
      localStorage.removeItem(META_TEST_STORAGE_KEYS.selectedAdSetId);
    }
  }
}

export function saveMetaTestJsonResult(type: string, data: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    META_TEST_STORAGE_KEYS.lastJsonResult,
    JSON.stringify(data, null, 2),
  );
  localStorage.setItem(META_TEST_STORAGE_KEYS.lastResultType, type);
}

export function loadMetaTestJsonResult(): {
  type: string | null;
  json: string | null;
} {
  if (typeof window === "undefined") return { type: null, json: null };
  return {
    type: localStorage.getItem(META_TEST_STORAGE_KEYS.lastResultType),
    json: localStorage.getItem(META_TEST_STORAGE_KEYS.lastJsonResult),
  };
}

export function clearMetaTestStorage(): void {
  if (typeof window === "undefined") return;
  Object.values(META_TEST_STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

export function isMetaTestTokenExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt;
}

export function formatTokenPreview(token: string | null): string {
  if (!token) return "—";
  if (token.length <= 20) return token;
  return `${token.slice(0, 20)}…`;
}

export function secondsUntilExpiry(expiresAt: number | null): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}
