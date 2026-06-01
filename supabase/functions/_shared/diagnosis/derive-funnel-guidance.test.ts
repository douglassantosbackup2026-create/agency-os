import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enrichCampaigns } from "./campaign-objective.ts";
import { deriveFunnelGuidanceForAi } from "./derive-analysis.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dir, "__fixtures__", "mixed-funnel-account.json"), "utf8"),
) as {
  campaigns_sample: Record<string, unknown>[];
  campaigns_insights: Record<string, unknown>[];
};

describe("deriveFunnelGuidanceForAi", () => {
  it("conta mista bloqueia overlap entre objetivos e exige ROAS só em Vendas", () => {
    const enriched = enrichCampaigns(
      fixture.campaigns_sample,
      fixture.campaigns_insights,
    );
    const facts = { ...fixture, campaigns_enriched: enriched };
    const g = deriveFunnelGuidanceForAi(facts);
    expect(g.mixed_funnel).toBe(true);
    expect(g.overlap_between_objectives_is_normal).toBe(true);
    expect(g.objective_families_present.length).toBeGreaterThanOrEqual(2);
    const text = g.mandatory_rules_pt.join(" ");
    expect(text).toMatch(/FUNIL MISTO/i);
    expect(text).toMatch(/NÃO é sobreposição/i);
    expect(text).toMatch(/family=sales|SOMENTE a campanhas family=sales/i);
  });
});
