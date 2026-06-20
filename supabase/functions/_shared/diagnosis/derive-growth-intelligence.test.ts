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

  it("não emite múltiplos vazamentos com a mesma frase-template 'abaixo do ROAS do nicho'", () => {
    const facts = attachCommercialToFacts(enrichPaprikaFacts());
    const gi = facts.growth_intelligence_derived as GrowthIntelligenceDerived;
    const titles = gi.moneyLeaks.map((l) => l.title);
    const matches = titles.filter((t) => /abaixo do ROAS do nicho/i.test(t));
    // No máximo 1 entrada agregada ("Outros conjuntos…").
    expect(matches.length).toBeLessThanOrEqual(1);
  });

  it("top 3 vazamentos cobrem pelo menos 2 categorias quando há diversidade disponível", () => {
    const facts = attachCommercialToFacts(enrichPaprikaFacts());
    const gi = facts.growth_intelligence_derived as GrowthIntelligenceDerived;
    if (gi.moneyLeaks.length < 3) return;
    const allCats = new Set(gi.moneyLeaks.map((l) => l.category));
    if (allCats.size < 2) return;
    const top3Cats = new Set(gi.moneyLeaks.slice(0, 3).map((l) => l.category));
    expect(top3Cats.size).toBeGreaterThanOrEqual(2);
  });

  it("soma dos vazamentos reconcilia com o gap do executiveImpact", () => {
    const facts = attachCommercialToFacts(enrichPaprikaFacts());
    const gi = facts.growth_intelligence_derived as GrowthIntelligenceDerived;
    const sum = gi.moneyLeaks.reduce((s, l) => s + l.monthlyImpactBrl, 0);
    const gap = gi.executiveImpact.gapMonthlyBrl;
    // Permitimos sum >= gap (decomposição pode somar acima), mas nunca gap muito acima da soma.
    expect(sum + 100).toBeGreaterThanOrEqual(gap);
  });
});

