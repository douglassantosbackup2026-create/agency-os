/**
 * Fase 2 — overlap de público com evidência ao nível ad set (mesma campanha).
 */

import { num } from "./campaign-objective.ts";

export type AdsetOverlapSignal = {
  campaign_id: string;
  campaign_name: string;
  adset_ids: string[];
  reach_rate_pct: number;
  frequency: number;
  note: string;
};

export function deriveAdsetOverlapSignals(
  adsetsInsights: Record<string, unknown>[] | undefined,
): AdsetOverlapSignal[] {
  if (!adsetsInsights?.length) return [];

  const byCampaign = new Map<string, Record<string, unknown>[]>();
  for (const row of adsetsInsights) {
    const cid = String(row.campaign_id ?? "");
    if (!cid) continue;
    const list = byCampaign.get(cid) ?? [];
    list.push(row);
    byCampaign.set(cid, list);
  }

  const signals: AdsetOverlapSignal[] = [];
  for (const [campaign_id, rows] of byCampaign) {
    if (rows.length < 2) continue;

    const suspicious = rows.filter((r) => {
      const impressions = num(r.impressions) ?? 0;
      const reach = num(r.reach) ?? 0;
      const freq = num(r.frequency) ?? 0;
      if (impressions <= 0 || reach <= 0) return false;
      const reachRate = (reach / impressions) * 100;
      return reachRate < 50 && freq >= 3.5;
    });

    if (suspicious.length >= 2) {
      const worst = suspicious.sort(
        (a, b) => (num(b.frequency) ?? 0) - (num(a.frequency) ?? 0),
      )[0];
      const impressions = num(worst.impressions) ?? 1;
      const reach = num(worst.reach) ?? 0;
      const reachRate = Math.round((reach / impressions) * 1000) / 10;
      signals.push({
        campaign_id,
        campaign_name: String(worst.campaign_name ?? campaign_id),
        adset_ids: suspicious.map((r) => String(r.adset_id ?? "")).filter(Boolean),
        reach_rate_pct: reachRate,
        frequency: num(worst.frequency) ?? 0,
        note: `${suspicious.length} conjunto(s) na mesma campanha com reach rate baixo e frequência elevada`,
      });
    }
  }

  return signals.slice(0, 5);
}
