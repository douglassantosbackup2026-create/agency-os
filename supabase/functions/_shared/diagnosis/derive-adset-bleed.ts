import { computeRoas, enrichCampaigns, num } from "./campaign-objective.ts";
import { referenceRoasBom } from "./niche-benchmarks-v1.ts";
import type { NicheContext } from "./derive-niche-context.ts";

export type AdsetBleedRow = {
  adsetId: string;
  adsetName: string;
  campaignName: string;
  spend: number;
  spendFormatted: string;
  roas: number | null;
  roasFormatted: string;
  expectedRevenueBrl: number;
  actualRevenueBrl: number;
  bleedBrl: number;
  bleedFormatted: string;
  learningStatus?: string;
};

function fmtBrl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function parsePurchaseRoas(row: Record<string, unknown>, spend: number): number | null {
  const pr = row.purchase_roas;
  if (Array.isArray(pr) && pr.length) {
    const v = num((pr[0] as Record<string, unknown>)?.value);
    if (v != null) return v;
  }
  return computeRoas(row.action_values, spend);
}

export function deriveAdsetBleedRanking(
  facts: Record<string, unknown> | null | undefined,
  niche: NicheContext,
  learningById?: Map<string, string>,
): AdsetBleedRow[] {
  const insights = Array.isArray(facts?.adsets_insights)
    ? (facts!.adsets_insights as Record<string, unknown>[])
    : [];
  const campaigns = Array.isArray(facts?.campaigns_sample)
    ? (facts!.campaigns_sample as Record<string, unknown>[])
    : [];
  const campInsights = Array.isArray(facts?.campaigns_insights)
    ? (facts!.campaigns_insights as Record<string, unknown>[])
    : [];
  const enriched = enrichCampaigns(campaigns, campInsights);
  const salesCampaignIds = new Set(
    enriched.filter((c) => c.family === "sales").map((c) => String(c.campaign_id)),
  );

  const roasRef = referenceRoasBom(niche.nicheKey);
  const rows: AdsetBleedRow[] = [];

  for (const r of insights) {
    const campaignId = String(r.campaign_id ?? "");
    if (!salesCampaignIds.has(campaignId)) continue;
    const spend = num(r.spend) ?? 0;
    if (spend < 30) continue;
    const roas = parsePurchaseRoas(r, spend);
    if (roas == null) continue;
    const actualRev = spend * roas;
    const expectedRev = spend * roasRef;
    const bleed = expectedRev > actualRev ? Math.round(expectedRev - actualRev) : 0;
    if (bleed < 50) continue;

    const adsetId = String(r.adset_id ?? "");
    rows.push({
      adsetId,
      adsetName: String(r.adset_name ?? adsetId).slice(0, 80),
      campaignName: String(r.campaign_name ?? "").slice(0, 80),
      spend,
      spendFormatted: fmtBrl(spend),
      roas: Math.round(roas * 100) / 100,
      roasFormatted: `${roas.toFixed(2)}×`,
      expectedRevenueBrl: Math.round(expectedRev),
      actualRevenueBrl: Math.round(actualRev),
      bleedBrl: bleed,
      bleedFormatted: fmtBrl(bleed),
      learningStatus: learningById?.get(adsetId),
    });
  }

  return rows.sort((a, b) => b.bleedBrl - a.bleedBrl).slice(0, 12);
}
