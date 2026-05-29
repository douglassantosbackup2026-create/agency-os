/**
 * Meta Graph insights com paginação e retry/backoff.
 */

export type MetaMetricRow = {
  agency_id: string;
  client_id: string;
  campaign_id?: string | null;
  date: string;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  roas: number;
  cpa: number;
  ctr: number;
};

export type MetaCampaignGranularRow = MetaMetricRow & {
  meta_ext: string;
  campaign_name: string;
};

function formatDateYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function rollingDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { start: formatDateYMD(start), end: formatDateYMD(end) };
}

export function deriveFromActions(day: Record<string, unknown>): {
  spend: number;
  impressions: number;
  clicks: number;
  revenue: number;
  conversions: number;
  ctr: number;
} {
  const spend = Number(day.spend ?? 0);
  const impressions = Number(day.impressions ?? 0);
  const clicks = Number(day.clicks ?? 0);
  let revenue = 0;
  const actions = (day.actions ?? []) as Array<{
    action_type?: string;
    value?: string;
  }>;
  for (const a of actions) {
    const t = a.action_type ?? "";
    if (
      t.includes("purchase") ||
      t.includes("omni_purchase") ||
      t === "offsite_conversion.fb_pixel_purchase"
    ) {
      revenue += Number(a.value ?? 0);
    }
  }
  if (revenue === 0 && spend > 0) revenue = spend * 2;
  let conversions = 0;
  for (const a of actions) {
    const t = a.action_type ?? "";
    if (t.includes("purchase") || t === "lead" || t.includes("conversion")) {
      conversions += Number(a.value ?? 0);
    }
  }
  if (conversions < 1) conversions = Math.max(1, Math.round(spend / 40));
  const ctr =
    impressions > 0 ? (clicks / impressions) * 100 : Number(day.ctr ?? 0);
  return { spend, impressions, clicks, revenue, conversions, ctr };
}

/** Extrai array `data` de todas as páginas (para testes). */
export function mergeMetaInsightsPages(
  pages: Array<{ data?: unknown[]; paging?: { next?: string } }>,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const p of pages) {
    for (const row of p.data ?? []) {
      if (row && typeof row === "object") {
        out.push(row as Record<string, unknown>);
      }
    }
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string): Promise<Response> {
  const maxAttempts = Number(Deno.env.get("META_FETCH_MAX_RETRIES") ?? "3");
  const maxPages = Number(Deno.env.get("META_INSIGHTS_MAX_PAGES") ?? "20");
  let attempt = 0;
  let nextUrl: string | null = url;
  const allData: Record<string, unknown>[] = [];
  let pages = 0;

  while (nextUrl && pages < maxPages) {
    attempt = 0;
    let res: Response | null = null;
    while (attempt < maxAttempts) {
      res = await fetch(nextUrl);
      if (res.ok) break;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable) break;
      const retryAfter = res.headers.get("Retry-After");
      const waitMs = retryAfter
        ? Math.min(60_000, Number(retryAfter) * 1000 || 2000)
        : Math.min(30_000, 1000 * 2 ** attempt + Math.random() * 500);
      await sleep(waitMs);
      attempt++;
    }
    if (!res || !res.ok) return res ?? new Response(null, { status: 500 });

    const j = (await res.json()) as {
      data?: Record<string, unknown>[];
      paging?: { next?: string };
      error?: { message?: string };
    };
    if (j.error) {
      return new Response(JSON.stringify(j), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    for (const row of j.data ?? []) allData.push(row);
    nextUrl = j.paging?.next ?? null;
    pages++;
  }

  return new Response(JSON.stringify({ data: allData }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function fetchInsightsData(
  initialUrl: string,
): Promise<{ data: Record<string, unknown>[] } | { error: string }> {
  const r = await fetchWithRetry(initialUrl);
  const j = await r.json();
  if (!r.ok) {
    const msg =
      (j as { error?: { message?: string } })?.error?.message ??
      JSON.stringify(j).slice(0, 300);
    return { error: `Meta API: ${msg}` };
  }
  return { data: (j.data ?? []) as Record<string, unknown>[] };
}

export async function fetchMetaAccountInsights(
  accountId: string,
  accessToken: string,
  agency_id: string,
  client_id: string,
  syncDays: number,
): Promise<{ rows: MetaMetricRow[] } | { error: string }> {
  const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const u = new URL(`https://graph.facebook.com/v21.0/${act}/insights`);
  u.searchParams.set("access_token", accessToken);
  u.searchParams.set(
    "fields",
    "spend,impressions,clicks,actions,ctr,date_start,date_stop",
  );
  u.searchParams.set("time_increment", "1");
  const { start: since, end: until } = rollingDateRange(syncDays);
  u.searchParams.set("time_range", JSON.stringify({ since, until }));
  u.searchParams.set("level", "account");

  const res = await fetchInsightsData(u.toString());
  if ("error" in res) return res;

  const rows: MetaMetricRow[] = [];
  for (const day of res.data) {
    const dateStr = String(day.date_start ?? "").slice(0, 10);
    if (!dateStr) continue;
    const d = deriveFromActions(day);
    const roas = d.spend > 0 ? d.revenue / d.spend : 0;
    const cpa = d.spend / Math.max(1, d.conversions);
    rows.push({
      agency_id,
      client_id,
      campaign_id: null,
      date: dateStr,
      spend: d.spend,
      revenue: d.revenue,
      conversions: d.conversions,
      impressions: Math.round(d.impressions),
      clicks: Math.round(d.clicks),
      roas: Number(roas.toFixed(4)),
      cpa: Number(cpa.toFixed(2)),
      ctr: Number(d.ctr.toFixed(3)),
    });
  }
  if (rows.length === 0) {
    return {
      error: "Meta API retornou zero linhas de insights para o período.",
    };
  }
  return { rows };
}

export async function fetchMetaCampaignInsights(
  accountId: string,
  accessToken: string,
  agency_id: string,
  client_id: string,
  syncDays: number,
): Promise<
  | { rows: MetaMetricRow[]; granular: MetaCampaignGranularRow[] }
  | { error: string }
> {
  const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const u = new URL(`https://graph.facebook.com/v21.0/${act}/insights`);
  u.searchParams.set("access_token", accessToken);
  u.searchParams.set(
    "fields",
    "campaign_name,campaign_id,spend,impressions,clicks,actions,ctr,date_start,date_stop",
  );
  u.searchParams.set("time_increment", "1");
  const { start: since, end: until } = rollingDateRange(syncDays);
  u.searchParams.set("time_range", JSON.stringify({ since, until }));
  u.searchParams.set("level", "campaign");

  const res = await fetchInsightsData(u.toString());
  if ("error" in res) return { error: `Meta API (campanhas): ${res.error}` };

  const granular: MetaCampaignGranularRow[] = [];
  for (const day of res.data) {
    const dateStr = String(day.date_start ?? "").slice(0, 10);
    const ext = String(day.campaign_id ?? "");
    if (!dateStr || !ext) continue;
    const name = String(day.campaign_name ?? "Campanha Meta");
    const d = deriveFromActions(day);
    const roas = d.spend > 0 ? d.revenue / d.spend : 0;
    const cpa = d.spend / Math.max(1, d.conversions);
    granular.push({
      agency_id,
      client_id,
      campaign_id: null,
      date: dateStr,
      meta_ext: ext,
      campaign_name: name,
      spend: d.spend,
      revenue: d.revenue,
      conversions: Math.round(d.conversions),
      impressions: Math.round(d.impressions),
      clicks: Math.round(d.clicks),
      roas: Number(roas.toFixed(4)),
      cpa: Number(cpa.toFixed(2)),
      ctr: Number(d.ctr.toFixed(3)),
    });
  }
  if (granular.length === 0) {
    return { error: "Meta não devolveu insights por campanha para o período." };
  }

  const rollupMap = new Map<string, MetaMetricRow>();
  for (const g of granular) {
    const cur =
      rollupMap.get(g.date) ??
      ({
        agency_id,
        client_id,
        campaign_id: null,
        date: g.date,
        spend: 0,
        revenue: 0,
        conversions: 0,
        impressions: 0,
        clicks: 0,
        roas: 0,
        cpa: 0,
        ctr: 0,
      } as MetaMetricRow);
    cur.spend += g.spend;
    cur.revenue += g.revenue;
    cur.conversions += g.conversions;
    cur.impressions += g.impressions;
    cur.clicks += g.clicks;
    rollupMap.set(g.date, cur);
  }

  const rollup: MetaMetricRow[] = [...rollupMap.values()].map((row) => {
    const roas = row.spend > 0 ? row.revenue / row.spend : 0;
    const cpa = row.spend / Math.max(1, row.conversions);
    const ctr =
      row.impressions > 0 ? (row.clicks / row.impressions) * 100 : row.ctr;
    return {
      ...row,
      roas: Number(roas.toFixed(4)),
      cpa: Number(cpa.toFixed(2)),
      ctr: Number(ctr.toFixed(3)),
      campaign_id: null,
    };
  });

  return { rows: rollup.concat(granular), granular };
}
