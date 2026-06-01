import { describe, expect, it } from "vitest";
import paprika from "./__fixtures__/paprika-account.json";
import { attachCommercialToFacts, buildFactsEnrichment } from "./derive-analysis.ts";
import type { GrowthIntelligenceDerived } from "./derive-growth-intelligence.ts";

function enrichPaprikaFacts(): Record<string, unknown> {
  const raw = paprika as Record<string, unknown>;
  const campaigns = raw.campaigns_sample as Record<string, unknown>[];
  const insights = raw.campaigns_insights as Record<string, unknown>[];
  const { campaigns_enriched, objective_spend_mix } = buildFactsEnrichment(
    campaigns,
    insights,
  );
  return {
    ...raw,
    campaigns_enriched,
    objective_spend_mix,
  };
}

describe("Growth Intelligence v3", () => {
  it("builds growth_intelligence_derived with 8 motores", () => {
    const facts = attachCommercialToFacts(enrichPaprikaFacts());
    const gi = facts.growth_intelligence_derived as GrowthIntelligenceDerived;
    expect(gi).toBeDefined();
    expect(gi.executiveImpact.investedFormatted).toContain("R$");
    expect(gi.maturity.score0to100).toBeGreaterThanOrEqual(0);
    expect(gi.maturity.score0to100).toBeLessThanOrEqual(100);
    expect(gi.maturity.enterpriseLabel).toBeTruthy();
    expect(Array.isArray(gi.moneyLeaks)).toBe(true);
    expect(Array.isArray(gi.benchmarkImpacts)).toBe(true);
    expect(gi.projections.scenarios.length).toBe(3);
  });
});
