import { describe, expect, it } from "vitest";
import { deriveAdCreativeSignals } from "./derive-ad-metrics.ts";

describe("derive-ad-metrics", () => {
  it("calcula outbound CTR e hook proxy quando campos existem", () => {
    const s = deriveAdCreativeSignals([
      {
        spend: "100",
        impressions: "10000",
        outbound_clicks: [{ action_type: "outbound_click", value: "120" }],
        video_3_sec_watched_actions: [{ action_type: "video_view", value: "800" }],
      },
    ]);
    expect(s?.topOutboundCtrPct).toBe(1.2);
    expect(s?.topHookRatePct).toBe(8);
    expect(s?.note).toMatch(/Outbound/);
  });

  it("usa actions video_view quando video_3_sec_watched_actions ausente", () => {
    const s = deriveAdCreativeSignals([
      {
        spend: "50",
        impressions: "5000",
        actions: [{ action_type: "video_view", value: "400" }],
      },
    ]);
    expect(s?.topHookRatePct).toBe(8);
  });
});
