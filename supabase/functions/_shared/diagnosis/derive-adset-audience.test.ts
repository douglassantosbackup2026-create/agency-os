import { describe, expect, it } from "vitest";
import { deriveAdsetOverlapSignals } from "./derive-adset-audience.ts";

describe("derive-adset-audience", () => {
  it("detecta overlap dentro da mesma campanha com 2+ ad sets suspeitos", () => {
    const signals = deriveAdsetOverlapSignals([
      {
        campaign_id: "c1",
        campaign_name: "Vendas A",
        adset_id: "as1",
        impressions: "10000",
        reach: "3000",
        frequency: "4.2",
      },
      {
        campaign_id: "c1",
        campaign_name: "Vendas A",
        adset_id: "as2",
        impressions: "8000",
        reach: "2500",
        frequency: "3.8",
      },
    ]);
    expect(signals.length).toBe(1);
    expect(signals[0].adset_ids.length).toBeGreaterThanOrEqual(2);
  });

  it("não sinaliza campanhas diferentes como um único overlap", () => {
    const signals = deriveAdsetOverlapSignals([
      {
        campaign_id: "c1",
        adset_id: "a1",
        impressions: "5000",
        reach: "2000",
        frequency: "4",
      },
      {
        campaign_id: "c2",
        adset_id: "a2",
        impressions: "5000",
        reach: "2000",
        frequency: "4",
      },
    ]);
    expect(signals.length).toBe(0);
  });
});
