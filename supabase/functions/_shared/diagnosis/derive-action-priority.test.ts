import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enrichCampaigns } from "./campaign-objective.ts";
import { buildCommercialDerived } from "./derive-commercial.ts";
import { buildSeniorDerived } from "./derive-senior.ts";
import { deriveScoreV2 } from "./derive-analysis.ts";
import { deriveHypothesisSeeds } from "./derive-hypothesis-seeds.ts";
import { deriveActionPriority, topActionsNow } from "./derive-action-priority.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dir, "__fixtures__", "mixed-funnel-account.json"), "utf8"),
) as {
  campaigns_sample: Record<string, unknown>[];
  campaigns_insights: Record<string, unknown>[];
};

describe("deriveActionPriority", () => {
  it("ordena por urgência e preenche impactBrl do leak", () => {
    const enriched = enrichCampaigns(
      fixture.campaigns_sample,
      fixture.campaigns_insights,
    );
    const facts = {
      ...fixture,
      campaigns_enriched: enriched,
      account_insights: { frequency: "1.8" },
    };
    const commercial = buildCommercialDerived(facts);
    const senior = buildSeniorDerived(facts, commercial, deriveScoreV2(facts).score);
    const seeds = deriveHypothesisSeeds(facts, senior, commercial);
    const actions = deriveActionPriority(
      senior,
      [
        {
          step: 1,
          action: "Revisar campanhas de Vendas em alerta",
          impact: "Reduzir desperdício",
          eta: "3-5 dias",
          relatedAxis: "sales",
        },
      ],
      seeds,
    );
    expect(actions.length).toBeGreaterThan(0);
    const now = topActionsNow(actions, 3);
    expect(now.every((a) => a.urgency === "now")).toBe(true);
    expect(actions[0].step).toBe(1);
  });
});
