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

/** Enriquece facts in-place com raw fetch (opcional — se já tiver dados, só deriva). */
export async function enrichFactsWithMetaSeniorFetch(
  facts: Record<string, unknown>,
  actId: string,
  token: string,
): Promise<void> {
  const current = dateRangeDaysAgo(0, 30);
  const previous = dateRangeDaysAgo(30, 30);

  try {
    facts.account_meta = await fetchAdAccountMeta(actId, token);
  } catch (e) {
    console.warn(`[meta-senior] account meta: ${String(e).slice(0, 120)}`);
  }

  try {
    const rich = await fetchAdsetInsightsRich(actId, token, 80);
    if (rich.length) facts.adsets_insights = rich;
  } catch (e) {
    console.warn(`[meta-senior] adset insights rich: ${String(e).slice(0, 120)}`);
  }

  try {
    facts.ads_insights_auction = await fetchAdsAuctionInsights(actId, token, 40);
  } catch (e) {
    console.warn(`[meta-senior] ads auction: ${String(e).slice(0, 120)}`);
    facts.ads_insights_auction = facts.ads_insights_top ?? [];
  }

  try {
    facts.adsets_insights_current = await fetchAdsetInsightsForRange(
      actId,
      token,
      current.since,
      current.until,
    );
    facts.adsets_insights_previous = await fetchAdsetInsightsForRange(
      actId,
      token,
      previous.since,
      previous.until,
    );
  } catch (e) {
    console.warn(`[meta-senior] adset trends: ${String(e).slice(0, 120)}`);
  }

  try {
    facts.adsets_config = await fetchAdsetsConfig(actId, token, 60);
  } catch (e) {
    console.warn(`[meta-senior] adsets config: ${String(e).slice(0, 120)}`);
  }

  try {
    facts.meta_recommendations_raw = await fetchAccountRecommendations(actId, token);
  } catch {
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
  const mix = facts.objective_spend_mix as { family?: string; spend_pct?: number }[] | undefined;
  const salesPct = mix?.find((m) => m.family === "sales")?.spend_pct ?? 0;

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
