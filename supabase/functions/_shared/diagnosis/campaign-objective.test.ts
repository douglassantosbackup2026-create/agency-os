import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  enrichCampaigns,
  mapObjectiveToFamily,
  computeSpendMix,
} from "./campaign-objective.ts";
import {
  deriveAccountObjectiveSummary,
  deriveCampaignBreakdownV2,
} from "./derive-analysis.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dir, "__fixtures__", "mixed-funnel-account.json"), "utf8"),
) as {
  campaigns_sample: Record<string, unknown>[];
  campaigns_insights: Record<string, unknown>[];
};

describe("campaign-objective", () => {
  it("mapObjectiveToFamily", () => {
    expect(mapObjectiveToFamily("OUTCOME_SALES")).toBe("sales");
    expect(mapObjectiveToFamily("OUTCOME_TRAFFIC")).toBe("traffic");
    expect(mapObjectiveToFamily("REACH")).toBe("awareness");
  });

  it("enrichCampaigns — conversão com ROAS e CPA coerentes", () => {
    const enriched = enrichCampaigns(
      fixture.campaigns_sample,
      fixture.campaigns_insights,
    );
    const conv = enriched.find((c) => c.campaign_id === "c1")!;
    expect(conv.family).toBe("sales");
    expect(conv.roas).not.toBeNull();
    expect(conv.roas!).toBeGreaterThan(4.9);
    expect(conv.roas!).toBeLessThan(5.0);
    const cpa = conv.spend / conv.primary_result.count;
    expect(cpa).toBeGreaterThan(230);
    expect(cpa).toBeLessThan(245);
  });

  it("Geo awareness — não alerta por ROAS ausente", () => {
    const enriched = enrichCampaigns(
      fixture.campaigns_sample,
      fixture.campaigns_insights,
    );
    const geo = enriched.find((c) => c.campaign_id === "c2")!;
    expect(geo.family).toBe("awareness");
    expect(geo.roas).toBeNull();
    expect(geo.kpi_status).not.toBe("alerta");
    expect(geo.primary_result.kind).toBe("reach");
  });

  it("Meio traffic — CTR alto classificado bem", () => {
    const enriched = enrichCampaigns(
      fixture.campaigns_sample,
      fixture.campaigns_insights,
    );
    const meio = enriched.find((c) => c.campaign_id === "c3")!;
    expect(meio.family).toBe("traffic");
    expect(meio.kpi_status).toBe("bom");
    expect(meio.primary_result.cost_per_result).toBeCloseTo(0.14, 2);
  });

  it("computeSpendMix — vendas domina gasto", () => {
    const enriched = enrichCampaigns(
      fixture.campaigns_sample,
      fixture.campaigns_insights,
    );
    const mix = computeSpendMix(enriched);
    expect(mix.sales).toBeGreaterThan(0.8);
  });
});

describe("derive-analysis v2", () => {
  it("sales_block CPA ~237 não ~28", () => {
    const facts = {
      ...fixture,
      campaigns_enriched: enrichCampaigns(
        fixture.campaigns_sample,
        fixture.campaigns_insights,
      ),
    };
    const summary = deriveAccountObjectiveSummary(facts);
    expect(summary.sales_block).not.toBeNull();
    expect(summary.sales_block!.cpa).toBeGreaterThan(230);
    expect(summary.sales_block!.cpa).toBeLessThan(245);
    expect(summary.mixed_funnel).toBe(true);
  });

  it("campaignBreakdown v2 tem objective_label", () => {
    const facts = {
      ...fixture,
      campaigns_enriched: enrichCampaigns(
        fixture.campaigns_sample,
        fixture.campaigns_insights,
      ),
    };
    const { rows } = deriveCampaignBreakdownV2(facts);
    expect(rows.length).toBe(3);
    expect(rows[0].objective_label).toBe("Vendas");
    expect(rows.find((r) => r.name.includes("Geo"))?.roas).toBe("—");
    expect(rows.find((r) => r.name.includes("Geo"))?.objective_label).toBe(
      "Reconhecimento",
    );
  });
});
