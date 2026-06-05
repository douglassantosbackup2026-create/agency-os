import { describe, expect, it } from "vitest";
import paprika from "./__fixtures__/paprika-account.json";
import { deriveAccountScore } from "./derive-account-score.ts";
import { deriveAccountFinancialGap } from "./derive-account-financial-gap.ts";
import { attachCommercialToFacts, deriveFunnelAnalysis } from "./derive-analysis.ts";
import { buildConsultativeDerived } from "./derive-consultative-blocks.ts";
import { deriveAdsetBleedRanking } from "./derive-adset-bleed.ts";
import { buildCommercialDerived } from "./derive-commercial.ts";
import { buildGrowthIntelligenceDerived } from "./derive-growth-intelligence.ts";
import { deriveGrowthScenarios } from "./derive-growth-scenarios.ts";
import { resolveNicheContext } from "./derive-niche-context.ts";
import { buildFactsEnrichment } from "./derive-analysis.ts";

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
    business_context: { target_roas: 10, niche: "moda" },
  };
}

function fullPipeline(facts: Record<string, unknown>) {
  buildConsultativeDerived(facts, facts.business_context as Record<string, unknown>);
  attachCommercialToFacts(facts);
  const commercial = buildCommercialDerived(facts);
  buildGrowthIntelligenceDerived(facts, commercial);
  return facts;
}

describe("Páprika v16", () => {
  it("resolve nicho moda por heurística", () => {
    const facts = enrichPaprikaFacts();
    const niche = resolveNicheContext(facts, facts.business_context as Record<string, unknown>);
    expect(niche.nicheKey).toBe("ecom_moda");
  });

  it("funil detecta gargalo checkout <35%", () => {
    const facts = enrichPaprikaFacts();
    const funnel = deriveFunnelAnalysis(facts);
    expect(funnel?.bottleneck).toBe("checkout");
    expect(funnel?.purchaseRate).toBeLessThan(35);
  });

  it("delivery summary reporta learning fail", () => {
    const facts = enrichPaprikaFacts();
    const c = buildConsultativeDerived(facts);
    expect(c.deliverySummary?.pctSpendNonOptimized).toBeGreaterThan(0);
    expect(c.adsetLearningStatus.some((a) => a.learning_status === "learning_fail")).toBe(
      true,
    );
  });

  it("account financial gap calcula gap positivo com meta 10×", () => {
    const facts = enrichPaprikaFacts();
    const niche = resolveNicheContext(facts, facts.business_context as Record<string, unknown>);
    const gap = deriveAccountFinancialGap(facts, niche, {
      target_roas: 10,
    });
    expect(gap?.gapMonthlyBrl).toBeGreaterThan(0);
    expect(gap?.roasReferenceNiche).toBe(10);
    expect(gap?.headlinePt).toContain("R$");
  });

  it("adset bleed rankeia conjuntos de vendas", () => {
    const facts = enrichPaprikaFacts();
    const niche = resolveNicheContext(facts, null);
    const bleed = deriveAdsetBleedRanking(facts, niche);
    expect(bleed.length).toBeGreaterThan(0);
    expect(bleed[0].adsetName).toBeTruthy();
  });

  it("consultative tem insight de checkout ou learning", () => {
    const facts = enrichPaprikaFacts();
    const c = buildConsultativeDerived(facts);
    expect(c.qaChecklist.hasSurpriseInsight).toBe(true);
  });

  it("score credível 45–55 com meta ROAS 10×", () => {
    const facts = fullPipeline(enrichPaprikaFacts());
    const score = deriveAccountScore(facts).score;
    expect(score).toBeGreaterThanOrEqual(45);
    expect(score).toBeLessThanOrEqual(55);
  });

  it("money leaks inclui checkout, learning e bleed", () => {
    const facts = fullPipeline(enrichPaprikaFacts());
    const gi = facts.growth_intelligence_derived as { moneyLeaks: { id: string }[] };
    expect(gi.moneyLeaks.length).toBeGreaterThanOrEqual(3);
    const ids = gi.moneyLeaks.map((l) => l.id);
    expect(ids.some((id) => id.startsWith("funnel:") || id.startsWith("learning:"))).toBe(true);
  });

  it("hero gap e projeções em R$", () => {
    const facts = fullPipeline(enrichPaprikaFacts());
    const commercial = buildCommercialDerived(facts);
    const story = commercial.storyExecutive;
    expect(story.primaryGapMonthlyBrl).toBeGreaterThan(0);
    expect(story.heroRangeFormatted).toContain("R$");
    const gs = deriveGrowthScenarios(commercial);
    expect(gs.conservativeFormatted).toContain("R$");
    expect(gs.conservativeMonthlyBrl).toBeGreaterThan(0);
  });
});
