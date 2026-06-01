import { num } from "./campaign-objective.ts";
import {
  summarizeAdsetTargeting,
  type AdsetTargetingRow,
} from "./derive-adset-targeting.ts";
import type { AdsetAudienceType, AdsetTrendRow } from "./meta-senior-types.ts";

function classifyAdsetAudience(
  name: string,
  optimizationGoal: string,
  promotedObject: unknown,
  targetingRow?: AdsetTargetingRow,
): AdsetAudienceType {
  const n = name.toLowerCase();
  if (/cat[aá]logo|catalog|dpa|dynamic/i.test(n)) return "catalog";
  if (/rmk|retarg|remarket|remarketing|remarket/i.test(n)) return "retargeting";
  if (targetingRow && targetingRow.custom_audience_ids.length > 0) {
    return "retargeting";
  }
  const po = promotedObject && typeof promotedObject === "object"
    ? JSON.stringify(promotedObject)
    : "";
  if (/purchase|offsite_conversion/i.test(po) && /rmk|retarg/i.test(n)) {
    return "retargeting";
  }
  if (/landing_page_view|link_click/i.test(optimizationGoal)) return "traffic";
  if (/reach|impression|brand/i.test(optimizationGoal)) return "awareness";
  if (/purchase|conversion/i.test(optimizationGoal)) return "prospecting";
  return "other";
}

function ctrFromRow(row: Record<string, unknown>): number {
  const ctr = num(row.ctr);
  if (ctr != null) return ctr;
  const imp = num(row.impressions) ?? 0;
  const clicks = num(row.clicks) ?? 0;
  if (imp <= 0) return 0;
  return (clicks / imp) * 100;
}

export function deriveAdsetPerformanceTrends(
  currentRows: Record<string, unknown>[] | undefined,
  previousRows: Record<string, unknown>[] | undefined,
  adsetsConfig: Record<string, unknown>[] | undefined,
): AdsetTrendRow[] {
  if (!currentRows?.length) return [];

  const targeting = summarizeAdsetTargeting(adsetsConfig);
  const targetingById = new Map(targeting.map((t) => [t.adset_id, t]));

  const configById = new Map<string, Record<string, unknown>>();
  for (const a of adsetsConfig ?? []) {
    configById.set(String(a.id ?? ""), a);
  }

  const prevById = new Map<string, Record<string, unknown>>();
  for (const r of previousRows ?? []) {
    prevById.set(String(r.adset_id ?? ""), r);
  }

  const out: AdsetTrendRow[] = [];

  for (const cur of currentRows) {
    const adsetId = String(cur.adset_id ?? "");
    if (!adsetId) continue;
    const spend = num(cur.spend) ?? 0;
    if (spend < 20) continue;

    const cfg = configById.get(adsetId);
    const name = String(cur.adset_name ?? cfg?.name ?? adsetId);
    const opt = String(cfg?.optimization_goal ?? "");
    const audienceType = classifyAdsetAudience(
      name,
      opt,
      cfg?.promoted_object,
      targetingById.get(adsetId),
    );

    const ctrNow = ctrFromRow(cur);
    const prev = prevById.get(adsetId);
    const ctrPrev = prev ? ctrFromRow(prev) : 0;

    let ctrChangePct: number | null = null;
    if (ctrPrev > 0.01) {
      ctrChangePct = Math.round(((ctrNow - ctrPrev) / ctrPrev) * 1000) / 10;
    } else if (ctrNow > 0) {
      ctrChangePct = 100;
    }

    let trend: AdsetTrendRow["trend"] = "flat";
    if (ctrChangePct != null) {
      if (ctrChangePct >= 5) trend = "good";
      else if (ctrChangePct <= -5) trend = "bad";
    }

    out.push({
      adsetId,
      adsetName: name.slice(0, 80),
      campaignName: String(cur.campaign_name ?? "").slice(0, 80),
      audienceType,
      ctrNow: Math.round(ctrNow * 100) / 100,
      ctrPrev: Math.round(ctrPrev * 100) / 100,
      ctrChangePct,
      trend,
    });
  }

  return out.sort((a, b) => {
    const absA = Math.abs(a.ctrChangePct ?? 0);
    const absB = Math.abs(b.ctrChangePct ?? 0);
    return absB - absA;
  });
}
