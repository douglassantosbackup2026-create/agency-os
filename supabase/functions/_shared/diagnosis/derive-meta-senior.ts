import {
  dateRangeDaysAgo,
  fetchAccountRecommendations,
  fetchAdAccountMeta,
  fetchAdsAuctionInsights,
  fetchAdsetInsightsForRange,
  fetchAdsetInsightsRich,
  fetchAdsetsConfig,
} from "../meta-diagnosis-fetch.ts";
import { deriveAdsetPerformanceTrends } from "./derive-adset-performance-trends.ts";
import { deriveAuctionDiagnostics } from "./derive-auction-diagnostics.ts";
import {
  computeOpportunityScore,
  deriveFunnelHealth,
} from "./derive-funnel-health.ts";
import { deriveStructureRecommendations } from "./derive-structure-recommendations.ts";
import type { MetaSeniorDerived } from "./meta-senior-types.ts";
import { deriveFunnelGuidanceForAi } from "./derive-analysis.ts";
import {
  createMetaGraphSession,
  type MetaGraphSession,
} from "../meta-graph-throttle.ts";

/** `objective_spend_mix` é fração por família (0–1); legado em array com spend_pct. */
function salesSpendPctFromMix(mix: unknown): number {
  if (Array.isArray(mix)) {
    const row = mix.find(
      (m) =>
        m &&
        typeof m === "object" &&
        (m as { family?: string }).family === "sales",
    ) as { spend_pct?: number } | undefined;
    return row?.spend_pct ?? 0;
  }
  if (mix && typeof mix === "object") {
    const sales = (mix as Record<string, number>).sales;
    return typeof sales === "number" ? Math.round(sales * 100) : 0;
  }
  return 0;
}

async function runMetaFetch(
  session: MetaGraphSession,
  label: string,
  fn: () => Promise<void>,
  optional = false,
): Promise<void> {
  if (optional && session.skipOptional()) return;
  try {
    await session.beforeFetch();
    await fn();
  } catch (e) {
    session.recordError(String(e));
    console.warn(`[meta-senior] ${label}: ${String(e).slice(0, 120)}`);
  }
}

/** Enriquece facts in-place com raw fetch (opcional — se já tiver dados, só deriva). */
export async function enrichFactsWithMetaSeniorFetch(
  facts: Record<string, unknown>,
  actId: string,
  token: string,
  metaSession?: MetaGraphSession,
  options?: { lite?: boolean },
): Promise<void> {
  const session = metaSession ?? createMetaGraphSession();
  const lite = options?.lite === true;
  const current = dateRangeDaysAgo(0, 30);
  const previous = dateRangeDaysAgo(30, 30);
  const adsetLimit = lite ? 50 : 80;

  await runMetaFetch(session, "account meta", async () => {
    facts.account_meta = await fetchAdAccountMeta(actId, token);
  });

  await runMetaFetch(session, "adset insights rich", async () => {
    const rich = await fetchAdsetInsightsRich(actId, token, adsetLimit);
    if (rich.length) facts.adsets_insights = rich;
  });

  if (!lite) {
    await runMetaFetch(session, "ads auction", async () => {
      facts.ads_insights_auction = await fetchAdsAuctionInsights(actId, token, 40);
    }, true);
  }
  if (!facts.ads_insights_auction) {
    facts.ads_insights_auction = facts.ads_insights_top ?? [];
  }

  if (!lite) {
    await runMetaFetch(session, "adset trends", async () => {
      facts.adsets_insights_current = await fetchAdsetInsightsForRange(
        actId,
        token,
        current.since,
        current.until,
      );
      await session.beforeFetch();
      facts.adsets_insights_previous = await fetchAdsetInsightsForRange(
        actId,
        token,
        previous.since,
        previous.until,
      );
    });
  }

  await runMetaFetch(session, "adsets config", async () => {
    facts.adsets_config = await fetchAdsetsConfig(actId, token, lite ? 40 : 60);
  }, true);

  if (!lite) {
    await runMetaFetch(session, "recommendations", async () => {
      facts.meta_recommendations_raw = await fetchAccountRecommendations(actId, token);
    }, true);
  }
  if (!facts.meta_recommendations_raw) {
    facts.meta_recommendations_raw = [];
  }
}

export function buildMetaSeniorDerived(
  facts: Record<string, unknown> | null | undefined,
): MetaSeniorDerived | null {
  if (!facts) return null;

  const adsRaw = (Array.isArray(facts.ads_insights_auction)
    ? facts.ads_insights_auction
    : facts.ads_insights_top) as Record<string, unknown>[] | undefined;

  const auction = deriveAuctionDiagnostics(adsRaw);
  const adsetTrends = deriveAdsetPerformanceTrends(
    facts.adsets_insights_current as Record<string, unknown>[] | undefined,
    facts.adsets_insights_previous as Record<string, unknown>[] | undefined,
    (facts.adsets_config ?? facts.adsets_targeting_sample) as
      | Record<string, unknown>[]
      | undefined,
  );

  const recommendations = deriveStructureRecommendations(
    facts,
    facts.meta_recommendations_raw as Record<string, unknown>[] | undefined,
  );

  const funnelHealth = deriveFunnelHealth(adsetTrends, auction, recommendations);
  const opportunityScore = computeOpportunityScore(funnelHealth);

  const guidance = deriveFunnelGuidanceForAi(facts);
  const salesPct = salesSpendPctFromMix(facts.objective_spend_mix);

  return {
    generatedAt: new Date().toISOString(),
    auctionDiagnostics: auction,
    adsetTrends,
    recommendations,
    funnelHealth,
    opportunityScore,
    accountSummary: {
      mixedFunnel: Boolean(guidance.mixed_funnel),
      primaryObjectiveLabel:
        salesPct >= 40 ? "Conversões" : guidance.objective_families_present?.[0] ?? "Misto",
      anomalyCount: funnelHealth.filter((f) => f.status === "critical").length,
    },
  };
}

export function attachMetaSeniorToFacts(
  facts: Record<string, unknown>,
): Record<string, unknown> {
  const meta = buildMetaSeniorDerived(facts);
  if (meta) {
    facts.meta_senior = meta;
  }
  return facts;
}

export function metaSeniorToAnalysisFields(
  meta: MetaSeniorDerived | null | undefined,
): Record<string, unknown> {
  if (!meta) return {};
  return { metaSenior: meta };
}
