import { describe, expect, it } from "vitest";
import {
  aiJobPollDone,
  syncMetricRowKeys,
  webhookEventIsDuplicate,
} from "./resilience-integration-helpers";

describe("resilience integration helpers", () => {
  it("syncMetricRowKeys deduplicates dates and campaign ids", () => {
    const keys = syncMetricRowKeys([
      { date: "2026-05-01", campaign_id: "a" },
      { date: "2026-05-01", campaign_id: "b" },
      { date: "2026-05-02", campaign_id: null },
    ]);
    expect(keys.dates).toEqual(["2026-05-01", "2026-05-02"]);
    expect(keys.campaignIds.sort()).toEqual(["a", "b"]);
  });

  it("webhookEventIsDuplicate detects unique violation", () => {
    expect(webhookEventIsDuplicate("23505")).toBe(true);
    expect(webhookEventIsDuplicate("42P01")).toBe(false);
  });

  it("aiJobPollDone maps terminal states", () => {
    expect(aiJobPollDone("done")).toBe("done");
    expect(aiJobPollDone("failed")).toBe("failed");
    expect(aiJobPollDone("processing")).toBe("pending");
  });
});
