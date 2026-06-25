/** Cache e completude de facts_json para process-diagnosis. */

export function isFactsEnrichmentComplete(
  facts: Record<string, unknown> | null | undefined,
): boolean {
  if (!facts) return false;
  const hasCampaignInsights = Array.isArray(facts.campaigns_insights);
  const hasAdsInsights =
    Array.isArray(facts.ads_insights_top) &&
    (facts.ads_insights_top as unknown[]).length > 0;
  const hasAdsetInsights = Array.isArray(facts.adsets_insights);
  const hasAdsetTargeting = Array.isArray(facts.adsets_targeting_sample);
  const hasCampaignsEnriched = Array.isArray(facts.campaigns_enriched);
  return (
    hasCampaignInsights &&
    hasAdsInsights &&
    hasAdsetInsights &&
    hasAdsetTargeting &&
    hasCampaignsEnriched
  );
}

const FACTS_CACHE_MS = 24 * 60 * 60 * 1000;

export function isFactsCacheFresh(
  facts: Record<string, unknown> | null | undefined,
): boolean {
  if (!facts) return false;
  const at = facts.generated_at;
  if (typeof at !== "string") return false;
  const age = Date.now() - new Date(at).getTime();
  return age >= 0 && age < FACTS_CACHE_MS;
}

export function shouldSkipMetaRefetch(
  facts: Record<string, unknown> | null | undefined,
): boolean {
  return isFactsEnrichmentComplete(facts) && isFactsCacheFresh(facts);
}

export type FetchLimits = {
  campaignSample: number;
  campaignInsights: number;
  adsetInsights: number;
  adsTop: number;
  targetingCampaigns: number;
};

export function fetchLimitsForAccount(smallAccount: boolean): FetchLimits {
  if (smallAccount) {
    return {
      campaignSample: 25,
      campaignInsights: 30,
      adsetInsights: 50,
      adsTop: 15,
      targetingCampaigns: 25,
    };
  }
  return {
    campaignSample: 40,
    campaignInsights: 50,
    adsetInsights: 80,
    adsTop: 25,
    targetingCampaigns: 40,
  };
}
