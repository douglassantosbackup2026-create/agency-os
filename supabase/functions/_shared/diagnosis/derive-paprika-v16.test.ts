import { describe, expect, it } from "vitest";
import paprika from "./__fixtures__/paprika-account.json";
import { deriveAccountFinancialGap } from "./derive-account-financial-gap.ts";
import { deriveFunnelAnalysis } from "./derive-analysis.ts";
import { buildConsultativeDerived } from "./derive-consultative-blocks.ts";
import { deriveAdsetBleedRanking } from "./derive-adset-bleed.ts";
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
  };
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

  it("account financial gap calcula gap positivo", () => {
    const facts = enrichPaprikaFacts();
    const niche = resolveNicheContext(facts, null);
    const gap = deriveAccountFinancialGap(facts, niche);
    expect(gap?.gapMonthlyBrl).toBeGreaterThanOrEqual(0);
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
});
