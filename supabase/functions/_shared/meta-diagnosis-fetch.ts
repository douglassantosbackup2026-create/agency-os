/**
 * Fetch Meta Graph para diagnóstico sênior (auction rankings, trends, ad sets).
 */

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dateRangeDaysAgo(endDaysAgo: number, spanDays: number): {
  since: string;
  until: string;
} {
  const until = new Date();
  until.setUTCDate(until.getUTCDate() - endDaysAgo);
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - (spanDays - 1));
  return { since: formatYmd(since), until: formatYmd(until) };
}

async function graphGet<T>(url: URL): Promise<T> {
  const r = await fetch(url.toString());
  const j = (await r.json()) as T & { error?: { message: string } };
  if ((j as { error?: { message: string } }).error) {
    throw new Error((j as { error: { message: string } }).error.message);
  }
  return j;
}

export async function fetchAdsAuctionInsights(
  actId: string,
  token: string,
  limit = 40,
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set("level", "ad");
  u.searchParams.set(
    "fields",
    [
      "ad_id",
      "ad_name",
      "campaign_name",
      "impressions",
      "clicks",
      "spend",
      "ctr",
      "actions",
      "action_values",
      "quality_ranking",
      "engagement_rate_ranking",
      "conversion_rate_ranking",
    ].join(","),
  );
  u.searchParams.set("date_preset", "last_30d");
  u.searchParams.set("sort", "spend_descending");
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("access_token", token);
  const j = await graphGet<{ data?: Record<string, unknown>[] }>(u);
  return j.data ?? [];
}

export async function fetchAdsetInsightsForRange(
  actId: string,
  token: string,
  since: string,
  until: string,
  limit = 80,
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/insights`);
  u.searchParams.set("level", "adset");
  u.searchParams.set(
    "fields",
    "adset_id,adset_name,campaign_id,campaign_name,impressions,clicks,spend,ctr,reach,frequency",
  );
  u.searchParams.set(
    "time_range",
    JSON.stringify({ since, until }),
  );
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("access_token", token);
  const j = await graphGet<{ data?: Record<string, unknown>[] }>(u);
  return j.data ?? [];
}

export async function fetchAdsetsConfig(
  actId: string,
  token: string,
  limit = 60,
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/adsets`);
  u.searchParams.set(
    "fields",
    "id,name,campaign_id,status,targeting,optimization_goal,promoted_object,is_dynamic_creative",
  );
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("access_token", token);
  const j = await graphGet<{ data?: Record<string, unknown>[] }>(u);
  return j.data ?? [];
}

/** Meta account recommendations — pode falhar por permissão. */
export async function fetchAccountRecommendations(
  actId: string,
  token: string,
): Promise<Record<string, unknown>[]> {
  const u = new URL(`https://graph.facebook.com/v21.0/${actId}/recommendations`);
  u.searchParams.set("access_token", token);
  try {
    const j = await graphGet<{ data?: Record<string, unknown>[] }>(u);
    return j.data ?? [];
  } catch {
    return [];
  }
}
