import { describe, expect, it } from "vitest";
import { deriveAuctionDiagnostics } from "./derive-auction-diagnostics.ts";
import { deriveAdsetPerformanceTrends } from "./derive-adset-performance-trends.ts";
import { buildMetaSeniorDerived } from "./derive-meta-senior.ts";

const paprikaAds = [
  {
    ad_id: "1",
    ad_name: "Vídeo Reels — Coleção Verão",
    campaign_name: "Conversão — Vendas",
    spend: "420.50",
    quality_ranking: "ABOVE_AVERAGE",
    engagement_rate_ranking: "ABOVE_AVERAGE",
    conversion_rate_ranking: "BOTTOM_20_PERCENT",
  },
  {
    ad_id: "2",
    ad_name: "Estático Feed — Promo",
    campaign_name: "Prospecção",
    spend: "180.00",
    quality_ranking: "AVERAGE",
    engagement_rate_ranking: "BELOW_AVERAGE",
    conversion_rate_ranking: "AVERAGE",
  },
];

describe("deriveAuctionDiagnostics", () => {
  it("marca bottom_20 com pauseCandidate quando gasto alto", () => {
    const rows = deriveAuctionDiagnostics(paprikaAds);
    const bad = rows.find((r) => r.adId === "1");
    expect(bad?.conversion).toBe("bottom_20");
    expect(bad?.pauseCandidate).toBe(true);
    expect(bad?.diagnosisPt).toContain("converte");
  });
});

describe("deriveAdsetPerformanceTrends", () => {
  it("calcula variação de CTR entre períodos", () => {
    const current = [
      {
        adset_id: "a1",
        adset_name: "RMK — Compradores 30d",
        campaign_name: "Retargeting",
        spend: "200",
        impressions: "10000",
        clicks: "250",
      },
    ];
    const previous = [
      {
        adset_id: "a1",
        spend: "180",
        impressions: "10000",
        clicks: "180",
      },
    ];
    const trends = deriveAdsetPerformanceTrends(current, previous, [
      { id: "a1", name: "RMK — Compradores 30d", optimization_goal: "OFFSITE_CONVERSIONS" },
    ]);
    expect(trends.length).toBe(1);
    expect(trends[0].ctrChangePct).toBeGreaterThan(0);
    expect(trends[0].audienceType).toBe("retargeting");
  });
});

describe("buildMetaSeniorDerived", () => {
  it("monta meta_senior completo a partir de facts", () => {
    const facts = {
      ads_insights_auction: paprikaAds,
      adsets_insights_current: [
        {
          adset_id: "a1",
          adset_name: "Prospecção LAL 1%",
          spend: "500",
          impressions: "20000",
          clicks: "200",
        },
      ],
      adsets_insights_previous: [
        {
          adset_id: "a1",
          spend: "400",
          impressions: "20000",
          clicks: "160",
        },
      ],
      adsets_config: [
        { id: "a1", name: "Prospecção LAL 1%", optimization_goal: "OFFSITE_CONVERSIONS" },
      ],
      campaigns_sample: [],
      campaigns_insights: [],
      objective_spend_mix: [{ family: "sales", spend_pct: 55 }],
    };
    const meta = buildMetaSeniorDerived(facts);
    expect(meta).not.toBeNull();
    expect(meta!.auctionDiagnostics.length).toBeGreaterThan(0);
    expect(meta!.opportunityScore).toBeGreaterThan(0);
    expect(meta!.funnelHealth.length).toBe(6);
  });
});
