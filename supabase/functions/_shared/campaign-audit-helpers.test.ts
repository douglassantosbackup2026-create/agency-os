import { describe, expect, it } from "vitest";
import {
  campaignAuditAggRankScore,
  clampRecommendations,
  extractJsonFromModelText,
  jaccardNames,
  mapTrackingHealthForAudit,
  matchScore,
  normalizeName,
  type AuditCampaignFlags,
} from "./campaign-audit-helpers";

const baseFlags = (): AuditCampaignFlags => ({
  low_volume: false,
  zero_conv_with_spend: false,
  tracking_critical: false,
  requires_human_review: false,
  strong_platform_ga4_divergence: false,
  ga4_external_id_match: false,
});

describe("campaign-audit-helpers", () => {
  it("mapTrackingHealthForAudit", () => {
    expect(mapTrackingHealthForAudit(undefined, false)).toBe("unavailable");
    expect(mapTrackingHealthForAudit("healthy", true)).toBe("healthy");
    expect(mapTrackingHealthForAudit("WARNING", true)).toBe("partial");
    expect(mapTrackingHealthForAudit("critical", true)).toBe("broken");
  });

  it("normalizeName e matchScore", () => {
    expect(normalizeName("  Café — Verão! ")).toContain("cafe");
    expect(matchScore("Summer Sale BR", "summer sale br")).toBe(1);
    expect(matchScore("Black Friday", "Friday Promo")).toBeGreaterThan(0);
    expect(jaccardNames("a b", "b c")).toBeGreaterThan(0);
  });

  it("extractJsonFromModelText", () => {
    expect(extractJsonFromModelText('prefix ```json\n{"a":1}\n```')).toBe(
      '{"a":1}',
    );
    expect(extractJsonFromModelText('x {"b":2} y')).toBe('{"b":2}');
  });

  it("campaignAuditAggRankScore penaliza unmatched", () => {
    const f = baseFlags();
    const hi = campaignAuditAggRankScore(
      {
        spend_30d: 100,
        spend_prev7: 0,
        roas_30d: 2,
        tracking_match: "matched",
        flags: f,
      },
      2,
    );
    const lo = campaignAuditAggRankScore(
      {
        spend_30d: 100,
        spend_prev7: 0,
        roas_30d: 2,
        tracking_match: "unmatched",
        flags: f,
      },
      2,
    );
    expect(lo).toBeGreaterThan(hi);
  });

  it("clampRecommendations força investigate em volume baixo + scale", () => {
    const cid = "c1";
    const flags = new Map<string, AuditCampaignFlags>([
      [
        cid,
        {
          ...baseFlags(),
          low_volume: true,
        },
      ],
    ]);
    const out = clampRecommendations(
      [
        {
          campaign_id: cid,
          suggestion_type: "scale",
          rationale: "test",
        },
      ],
      flags,
    ) as Record<string, unknown>[];
    expect(out[0].suggestion_type).toBe("investigate");
    expect(String(out[0].rationale)).toContain("Governança");
  });
});
