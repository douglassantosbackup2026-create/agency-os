import { describe, expect, it } from "vitest";
import {
  findDuplicateAudienceTargeting,
  summarizeAdsetTargeting,
} from "./derive-adset-targeting.ts";

describe("derive-adset-targeting", () => {
  it("detecta mesmo custom_audience em ad sets da mesma campanha", () => {
    const rows = summarizeAdsetTargeting([
      {
        id: "as1",
        campaign_id: "c1",
        name: "A",
        targeting: { custom_audiences: [{ id: "aud99" }] },
      },
      {
        id: "as2",
        campaign_id: "c1",
        name: "B",
        targeting: { custom_audiences: [{ id: "aud99" }] },
      },
    ]);
    const dupes = findDuplicateAudienceTargeting(rows);
    expect(dupes.length).toBe(1);
    expect(dupes[0].adset_ids.length).toBe(2);
  });
});
