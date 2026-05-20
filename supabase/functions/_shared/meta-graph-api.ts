/** Shared Meta Marketing API helpers for Edge Functions (test harness + reuse). */

export const META_OAUTH_SCOPES = "ads_read,ads_management,business_management";

/** Overrides opcionais (dev_config do harness); senão usa Deno.env. */
export type MetaGraphEnv = {
  metaAppId?: string;
  metaAppSecret?: string;
  metaApiVersion?: string;
};

function pickEnv(cfg?: MetaGraphEnv) {
  const appId = cfg?.metaAppId?.trim() || Deno.env.get("META_APP_ID")?.trim();
  const appSecret =
    cfg?.metaAppSecret?.trim() || Deno.env.get("META_APP_SECRET")?.trim();
  const version =
    cfg?.metaApiVersion?.trim() || Deno.env.get("META_API_VERSION")?.trim();
  return { appId, appSecret, version };
}

export function metaApiVersion(cfg?: MetaGraphEnv): string {
  const { version } = pickEnv(cfg);
  return version && version.startsWith("v") ? version : "v21.0";
}

export function graphBase(cfg?: MetaGraphEnv): string {
  return `https://graph.facebook.com/${metaApiVersion(cfg)}`;
}

export function isAllowedTestRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    return (
      (u.protocol === "http:" &&
        (u.hostname === "localhost" || u.hostname === "127.0.0.1")) ||
      false
    );
  } catch {
    return false;
  }
}

export type MetaGraphErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export function formatMetaError(body: unknown, status: number): string {
  const j = body as MetaGraphErrorBody;
  const e = j?.error;
  if (!e?.message) {
    const raw =
      typeof body === "string" ? body : JSON.stringify(body).slice(0, 400);
    return `Meta API HTTP ${status}: ${raw}`;
  }
  const parts = [e.message];
  if (e.type) parts.push(`type=${e.type}`);
  if (e.code != null) parts.push(`code=${e.code}`);
  if (e.error_subcode != null) parts.push(`subcode=${e.error_subcode}`);
  if (e.fbtrace_id) parts.push(`trace=${e.fbtrace_id}`);
  return parts.join(" | ");
}

export async function parseMetaResponse<T>(
  r: Response,
): Promise<{ ok: true; data: T; raw: unknown } | { ok: false; error: string }> {
  let raw: unknown;
  try {
    raw = await r.json();
  } catch {
    raw = { _parse_error: await r.text().catch(() => "") };
  }
  if (!r.ok) {
    return { ok: false, error: formatMetaError(raw, r.status) };
  }
  return { ok: true, data: raw as T, raw };
}

function normalizeActId(adAccountId: string): string {
  return adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
}

function rollingDateRange(days: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date(until.getTime() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { since: fmt(since), until: fmt(until) };
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
  cfg?: MetaGraphEnv,
): Promise<
  | { ok: true; access_token: string; expires_in?: number }
  | { ok: false; error: string }
> {
  const { appId, appSecret } = pickEnv(cfg);
  if (!appId || !appSecret) {
    return { ok: false, error: "META_APP_ID ou META_APP_SECRET ausentes" };
  }
  const u = new URL(`${graphBase(cfg)}/oauth/access_token`);
  u.searchParams.set("client_id", appId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("client_secret", appSecret);
  u.searchParams.set("code", code);
  const r = await fetch(u.toString());
  const parsed = await parseMetaResponse<{
    access_token: string;
    expires_in?: number;
  }>(r);
  if (!parsed.ok) return parsed;
  if (!parsed.data.access_token) {
    return { ok: false, error: "Resposta OAuth sem access_token" };
  }
  return {
    ok: true,
    access_token: parsed.data.access_token,
    expires_in: parsed.data.expires_in,
  };
}

export async function exchangeForLongLivedToken(
  shortToken: string,
  cfg?: MetaGraphEnv,
): Promise<
  | { ok: true; access_token: string; expires_in?: number }
  | { ok: false; error: string }
> {
  const { appId, appSecret } = pickEnv(cfg);
  if (!appId || !appSecret) {
    return { ok: false, error: "META_APP_ID ou META_APP_SECRET ausentes" };
  }
  const u = new URL(`${graphBase(cfg)}/oauth/access_token`);
  u.searchParams.set("grant_type", "fb_exchange_token");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("client_secret", appSecret);
  u.searchParams.set("fb_exchange_token", shortToken);
  const r = await fetch(u.toString());
  const parsed = await parseMetaResponse<{
    access_token: string;
    expires_in?: number;
  }>(r);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    access_token: parsed.data.access_token ?? shortToken,
    expires_in: parsed.data.expires_in,
  };
}

export function buildMetaOAuthUrl(
  redirectUri: string,
  state: string,
  cfg?: MetaGraphEnv,
): string | { error: string } {
  const { appId } = pickEnv(cfg);
  if (!appId) return { error: "META_APP_ID ausente" };
  const fb = new URL(
    `https://www.facebook.com/${metaApiVersion(cfg)}/dialog/oauth`,
  );
  fb.searchParams.set("client_id", appId);
  fb.searchParams.set("redirect_uri", redirectUri);
  fb.searchParams.set("scope", META_OAUTH_SCOPES);
  fb.searchParams.set("state", state);
  fb.searchParams.set("response_type", "code");
  return fb.toString();
}

export async function fetchAdAccounts(accessToken: string, cfg?: MetaGraphEnv) {
  const u = new URL(`${graphBase(cfg)}/me/adaccounts`);
  u.searchParams.set(
    "fields",
    "id,account_id,name,account_status,currency,timezone_name,business_name",
  );
  u.searchParams.set("access_token", accessToken);
  u.searchParams.set("limit", "100");
  const r = await fetch(u.toString());
  const parsed = await parseMetaResponse<{ data?: Record<string, unknown>[] }>(
    r,
  );
  if (!parsed.ok) return parsed;
  return {
    ok: true as const,
    data: parsed.data.data ?? [],
    raw: parsed.raw,
  };
}

export async function fetchCampaigns(
  accessToken: string,
  adAccountId: string,
  cfg?: MetaGraphEnv,
) {
  const act = normalizeActId(adAccountId);
  const u = new URL(`${graphBase(cfg)}/${act}/campaigns`);
  u.searchParams.set(
    "fields",
    "id,name,status,objective,daily_budget,lifetime_budget,created_time,updated_time",
  );
  u.searchParams.set("access_token", accessToken);
  u.searchParams.set("limit", "100");
  const r = await fetch(u.toString());
  const parsed = await parseMetaResponse<{ data?: Record<string, unknown>[] }>(
    r,
  );
  if (!parsed.ok) return parsed;
  return {
    ok: true as const,
    data: parsed.data.data ?? [],
    raw: parsed.raw,
  };
}

export async function fetchInsights(
  accessToken: string,
  adAccountId: string,
  days = 90,
  cfg?: MetaGraphEnv,
) {
  const act = normalizeActId(adAccountId);
  const u = new URL(`${graphBase(cfg)}/${act}/insights`);
  u.searchParams.set("access_token", accessToken);
  u.searchParams.set(
    "fields",
    "spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,action_values,date_start,date_stop",
  );
  u.searchParams.set("level", "account");
  if (days === 90) {
    u.searchParams.set("date_preset", "last_90d");
  } else {
    const { since, until } = rollingDateRange(days);
    u.searchParams.set("time_range", JSON.stringify({ since, until }));
  }
  const r = await fetch(u.toString());
  const parsed = await parseMetaResponse<{ data?: Record<string, unknown>[] }>(
    r,
  );
  if (!parsed.ok) return parsed;
  const rows = parsed.data.data ?? [];
  return {
    ok: true as const,
    data: rows.length === 1 ? rows[0] : rows,
    raw: parsed.raw,
  };
}

export async function fetchAdSets(
  accessToken: string,
  campaignId: string,
  cfg?: MetaGraphEnv,
) {
  const u = new URL(`${graphBase(cfg)}/${campaignId}/adsets`);
  u.searchParams.set(
    "fields",
    "id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event",
  );
  u.searchParams.set("access_token", accessToken);
  u.searchParams.set("limit", "100");
  const r = await fetch(u.toString());
  const parsed = await parseMetaResponse<{ data?: Record<string, unknown>[] }>(
    r,
  );
  if (!parsed.ok) return parsed;
  return {
    ok: true as const,
    data: parsed.data.data ?? [],
    raw: parsed.raw,
  };
}

export async function fetchAds(
  accessToken: string,
  adSetId: string,
  cfg?: MetaGraphEnv,
) {
  const u = new URL(`${graphBase(cfg)}/${adSetId}/ads`);
  u.searchParams.set("fields", "id,name,status,adset_id,campaign_id,creative");
  u.searchParams.set("access_token", accessToken);
  u.searchParams.set("limit", "100");
  const r = await fetch(u.toString());
  const parsed = await parseMetaResponse<{ data?: Record<string, unknown>[] }>(
    r,
  );
  if (!parsed.ok) return parsed;
  return {
    ok: true as const,
    data: parsed.data.data ?? [],
    raw: parsed.raw,
  };
}
