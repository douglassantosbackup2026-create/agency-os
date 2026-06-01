import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enrichCampaigns } from "./campaign-objective.ts";
import { buildCommercialDerived, deriveWasteBreakdown } from "./derive-commercial.ts";
import { deriveTopFindings } from "./derive-top-findings.ts";
import { deriveFinancialBalance } from "./derive-financial-balance.ts";

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
  return { ...fixture, campaigns_enriched: enriched };
}

describe("derive-top-findings", () => {
  it("retorna até 3 achados com campanha e valor em R$", () => {
    const facts = factsFromFixture();
    const commercial = buildCommercialDerived(facts);
    const findings = deriveTopFindings(facts, commercial.waste, commercial.benchmarkComparison);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.length).toBeLessThanOrEqual(3);
    expect(findings[0].headline.length).toBeGreaterThan(10);
    expect(
      findings[0].monthlyImpactFormatted.includes("R$") ||
        findings[0].headline.includes("R$") ||
        findings[0].headline.includes("ROAS"),
    ).toBe(true);
    expect(findings[0].actionHint.length).toBeGreaterThan(5);
  });

  it("não duplica campaign_id no top 3", () => {
    const facts = factsFromFixture();
    const waste = deriveWasteBreakdown(facts);
    const commercial = buildCommercialDerived(facts);
    const findings = deriveTopFindings(facts, waste, commercial.benchmarkComparison);
    const names = findings.map((f) => f.campaignName);
    expect(new Set(names).size).toBe(names.length);
  });

  it("financial balance coerente com economics e waste", () => {
    const commercial = buildCommercialDerived(factsFromFixture());
    const balance = deriveFinancialBalance(
      commercial.accountEconomics,
      commercial.waste,
      commercial.recovery,
    );
    expect(balance.invested30d).toBe(commercial.accountEconomics.spend30d);
    expect(balance.atRisk30d).toBe(commercial.waste.totalMonthlyBrl);
    expect(balance.netPositionLabel.length).toBeGreaterThan(10);
  });
});

describe("derive-commercial v10 fields", () => {
  it("buildCommercialDerived inclui topFindings e financialBalance", () => {
    const commercial = buildCommercialDerived(factsFromFixture());
    expect(commercial.topFindings.length).toBeGreaterThanOrEqual(1);
    expect(commercial.financialBalance.investedFormatted).toMatch(/R\$/);
  });

  it("benchmark gaps têm deltaLabel e isBad", () => {
    const commercial = buildCommercialDerived(factsFromFixture());
    const gap = commercial.benchmarkComparison.gaps[0];
    expect(gap.deltaLabel).toBeDefined();
    expect(typeof gap.isBad).toBe("boolean");
  });
});
