import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enrichCampaigns } from "./campaign-objective.ts";
import {
  buildCommercialDerived,
  campaignWasteFraction,
  deriveWasteBreakdown,
} from "./derive-commercial.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dir, "__fixtures__", "mixed-funnel-account.json"), "utf8"),
) as {
  campaigns_sample: Record<string, unknown>[];
  campaigns_insights: Record<string, unknown>[];
};

function factsFromFixture() {
  const enriched = enrichCampaigns(
    fixture.campaigns_sample,
    fixture.campaigns_insights,
  );
  return {
    ...fixture,
    campaigns_enriched: enriched,
  };
}

describe("derive-commercial", () => {
  it("Geo/Meio não contam perda total por ROAS de compra", () => {
    const enriched = enrichCampaigns(
      fixture.campaigns_sample,
      fixture.campaigns_insights,
    );
    const geo = enriched.find((c) => c.campaign_id === "c2")!;
    const meio = enriched.find((c) => c.campaign_id === "c3")!;
    expect(campaignWasteFraction(geo)).toBeLessThan(0.2);
    expect(campaignWasteFraction(meio)).toBeLessThan(0.2);
  });

  it("conta mista GM — ROAS vendas ~4,95 e perda focada em vendas", () => {
    const facts = factsFromFixture();
    const commercial = buildCommercialDerived(facts);
    expect(commercial.accountEconomics.roasSales).not.toBeNull();
    expect(commercial.accountEconomics.roasSales!).toBeGreaterThan(4.9);
    expect(commercial.accountEconomics.roasSales!).toBeLessThan(5.0);
    const waste = deriveWasteBreakdown(facts);
    const salesLines = waste.lines.filter((l) =>
      /vendas/i.test(l.label),
    );
    expect(salesLines.length).toBeGreaterThanOrEqual(0);
    expect(waste.totalMonthlyBrl).toBeLessThan(
      commercial.accountEconomics.spend30d,
    );
  });

  it("storyExecutive tem headline e faixa de recuperação", () => {
    const commercial = buildCommercialDerived(factsFromFixture());
    expect(commercial.storyExecutive.headline.length).toBeGreaterThan(20);
    expect(commercial.recovery.conservativeMonthlyBrl).toBeGreaterThanOrEqual(0);
    expect(commercial.recovery.optimisticMonthlyBrl).toBeGreaterThanOrEqual(
      commercial.recovery.conservativeMonthlyBrl,
    );
  });

  it("benchmark gaps incluem ROAS quando há vendas", () => {
    const commercial = buildCommercialDerived(factsFromFixture());
    const roasGap = commercial.benchmarkComparison.gaps.find((g) =>
      /roas/i.test(g.metric),
    );
    expect(roasGap).toBeDefined();
    expect(["above", "within"]).toContain(roasGap!.status);
  });

  it("scoreExplanation lista pilares", () => {
    const commercial = buildCommercialDerived(factsFromFixture());
    expect(commercial.scoreExplanation.pillars.length).toBeGreaterThanOrEqual(3);
    expect(commercial.scoreExplanation.formulaNote).toMatch(/0–100/);
  });
});
