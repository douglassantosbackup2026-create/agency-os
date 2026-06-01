import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enrichCampaigns } from "./campaign-objective.ts";
import { buildCommercialDerived } from "./derive-commercial.ts";
import { deriveCreativeDependency } from "./derive-creative-diagnosis.ts";
import { deriveAudienceDiagnosis } from "./derive-audience-diagnosis.ts";
import { deriveMaturityScore } from "./derive-maturity.ts";
import { deriveGrowthScenarios } from "./derive-growth-scenarios.ts";
import { deriveLeakByAxis } from "./derive-leak-by-axis.ts";
import { buildSeniorDerived } from "./derive-senior.ts";
import { deriveScoreV2 } from "./derive-analysis.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dir, "__fixtures__", "mixed-funnel-account.json"), "utf8"),
) as {
  campaigns_sample: Record<string, unknown>[];
  campaigns_insights: Record<string, unknown>[];
};

function factsFromFixture(extra: Record<string, unknown> = {}) {
  const enriched = enrichCampaigns(
    fixture.campaigns_sample,
    fixture.campaigns_insights,
  );
  return {
    ...fixture,
    ...extra,
    campaigns_enriched: enriched,
    account_insights: { frequency: "1.8", impressions: "710000", reach: "400000" },
  };
}

describe("derive-senior", () => {
  it("funil misto — audiência não acusa sobreposição genérica", () => {
    const facts = factsFromFixture();
    const audience = deriveAudienceDiagnosis(facts);
    expect(audience.dataAvailable).toBe("partial");
    expect(audience.headline.toLowerCase()).not.toMatch(/sobreposição entre campanhas/);
    expect(audience.headline).toMatch(/funil misto|objetivos distintos|frequência/i);
  });

  it("maturidade entre 1 e 5 com pilares", () => {
    const facts = factsFromFixture();
    const commercial = buildCommercialDerived(facts);
    const score = deriveScoreV2(facts);
    const maturity = deriveMaturityScore(facts, commercial, score.score);
    expect(maturity.level).toBeGreaterThanOrEqual(1);
    expect(maturity.level).toBeLessThanOrEqual(5);
    expect(maturity.pillars.length).toBe(5);
    expect(maturity.label.length).toBeGreaterThan(3);
  });

  it("growth scenarios — 3 faixas com disclaimer", () => {
    const commercial = buildCommercialDerived(factsFromFixture());
    const growth = deriveGrowthScenarios(commercial);
    expect(growth.conservativePct).toBeLessThan(growth.probablePct);
    expect(growth.probablePct).toBeLessThan(growth.aggressivePct);
    expect(growth.basisNote).toMatch(/indicativ/i);
    expect(growth.confidence).toBeDefined();
  });

  it("leakByAxis agrupa por eixo quando há waste", () => {
    const facts = factsFromFixture();
    const commercial = buildCommercialDerived(facts);
    const senior = buildSeniorDerived(facts, commercial, 72);
    if (commercial.waste.totalMonthlyBrl > 0) {
      expect(senior.leakByAxis.length).toBeGreaterThan(0);
      for (const item of senior.leakByAxis) {
        expect(["structure", "audience", "creative", "sales"]).toContain(item.axis);
        expect(item.monthlyBrl).toBeGreaterThan(0);
      }
    }
  });

  it("buildSeniorDerived expõe 5 capítulos", () => {
    const facts = factsFromFixture();
    const commercial = buildCommercialDerived(facts);
    const senior = buildSeniorDerived(facts, commercial, 70);
    expect(senior.diagnostics.structure).toBeDefined();
    expect(senior.diagnostics.audience).toBeDefined();
    expect(senior.diagnostics.creative).toBeDefined();
    expect(senior.diagnostics.scale).toBeDefined();
    expect(senior.diagnostics.financial).toBeDefined();
    expect(senior.risks.length).toBeGreaterThanOrEqual(0);
  });

  it("creative dependency calculável com 3+ ads", () => {
    const facts = factsFromFixture({
      ads_insights_top: [
        { ad_id: "a1", ad_name: "Ad A", spend: "5000", action_values: [{ action_type: "purchase", value: "20000" }] },
        { ad_id: "a2", ad_name: "Ad B", spend: "500", action_values: [] },
        { ad_id: "a3", ad_name: "Ad C", spend: "300", action_values: [] },
      ],
    });
    const dep = deriveCreativeDependency(facts);
    expect(dep).not.toBeNull();
    expect(dep!.topAdSpendSharePct).toBeGreaterThan(50);
    expect(dep!.isHighDependency).toBe(true);
  });

  it("estrutura reconhece mix Geo+Meio+Conversão", () => {
    const facts = factsFromFixture();
    const senior = buildSeniorDerived(facts, buildCommercialDerived(facts), 75);
    expect(senior.diagnostics.structure.evidence).toMatch(/família/i);
  });
});
