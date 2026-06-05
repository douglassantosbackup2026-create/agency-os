import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommercialDerived } from "./derive-commercial.ts";
import { deriveGrowthScenarios } from "./derive-growth-scenarios.ts";
import { buildFactsEnrichment } from "./derive-analysis.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const paprika = JSON.parse(
  readFileSync(join(__dir, "__fixtures__", "paprika-account.json"), "utf8"),
) as Record<string, unknown>;

describe("deriveGrowthScenarios", () => {
  it("formatted inclui R$ quando há receita", () => {
    const campaigns = paprika.campaigns_sample as Record<string, unknown>[];
    const insights = paprika.campaigns_insights as Record<string, unknown>[];
    const { campaigns_enriched, objective_spend_mix } = buildFactsEnrichment(
      campaigns,
      insights,
    );
    const facts = {
      ...paprika,
      campaigns_enriched,
      objective_spend_mix,
      business_context: { target_roas: 10 },
    };
    buildCommercialDerived(facts);
    const commercial = buildCommercialDerived(facts);
    const gs = deriveGrowthScenarios(commercial);
    expect(gs.conservativeFormatted).toMatch(/R\$/);
    expect(gs.probableFormatted).toMatch(/R\$/);
    expect(gs.conservativeMonthlyBrl).toBeGreaterThan(0);
  });
});
