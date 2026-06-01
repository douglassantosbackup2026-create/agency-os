import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enrichCampaigns } from "./campaign-objective.ts";
import { buildCommercialDerived } from "./derive-commercial.ts";
import { buildSeniorDerived } from "./derive-senior.ts";
import { deriveScoreV2 } from "./derive-analysis.ts";
import { deriveHypothesisSeeds } from "./derive-hypothesis-seeds.ts";

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

describe("deriveHypothesisSeeds", () => {
  it("funil misto gera seed contra overlap genérico, não seed de overlap ad set", () => {
    const facts = factsFromFixture();
    const commercial = buildCommercialDerived(facts);
    const score = deriveScoreV2(facts);
    const senior = buildSeniorDerived(facts, commercial, score.score);
    const seeds = deriveHypothesisSeeds(facts, senior, commercial);
    expect(seeds.some((s) => s.id === "funnel-mixed-not-overlap")).toBe(true);
    expect(seeds.some((s) => s.id === "audience-overlap-adset")).toBe(false);
  });

  it("dependência criativa gera seed quando top ad domina gasto", () => {
    const facts = factsFromFixture({
      ads_insights_top: [
        { ad_id: "a1", ad_name: "Hero", spend: "6000", action_values: [{ action_type: "purchase", value: "15000" }] },
        { ad_id: "a2", ad_name: "B", spend: "400", action_values: [] },
        { ad_id: "a3", ad_name: "C", spend: "200", action_values: [] },
      ],
    });
    const commercial = buildCommercialDerived(facts);
    const senior = buildSeniorDerived(facts, commercial, 65);
    const seeds = deriveHypothesisSeeds(facts, senior, commercial);
    expect(seeds.some((s) => s.id === "creative-single-asset-risk")).toBe(true);
  });
});
