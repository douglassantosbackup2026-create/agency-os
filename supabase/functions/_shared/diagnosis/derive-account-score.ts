import {
  type CampaignEnriched,
  type DerivedStatus,
  enrichCampaigns,
  scoreCampaignKpi,
} from "./campaign-objective.ts";
import type { BusinessContextInput } from "./derive-business-hints.ts";
import { resolveRoasTarget } from "./derive-roas-target.ts";

function getEnriched(facts: Record<string, unknown> | null | undefined): CampaignEnriched[] {
  if (!facts) return [];
  if (Array.isArray(facts.campaigns_enriched)) {
    return facts.campaigns_enriched as CampaignEnriched[];
  }
  const sample = Array.isArray(facts.campaigns_sample)
    ? (facts.campaigns_sample as Record<string, unknown>[])
    : [];
  const insights = Array.isArray(facts.campaigns_insights)
    ? (facts.campaigns_insights as Record<string, unknown>[])
    : [];
  return enrichCampaigns(sample, insights);
}

export function deriveAccountScore(
  facts: Record<string, unknown> | null | undefined,
): { score: number; scoreLabel: string } {
  const enriched = getEnriched(facts);
  if (enriched.length === 0) {
    return { score: 50, scoreLabel: "Regular" };
  }

  const ctx = facts?.business_context as BusinessContextInput | undefined;
  const nicheKey =
    (facts?.niche_context as { nicheKey?: string } | undefined)?.nicheKey ?? "ecom_geral";
  const roasTarget = resolveRoasTarget(ctx, nicheKey).target;

  const statusPoints: Record<DerivedStatus, number> = {
    bom: 100,
    atenção: 72,
    alerta: 45,
    "sem tracking": 55,
    "sem dados": 60,
  };

  let weighted = 0;
  let totalSpend = 0;
  for (const c of enriched) {
    let status = c.kpi_status;
    if (c.family === "sales" && c.roas != null) {
      status = scoreCampaignKpi({
        family: c.family,
        spend: c.spend,
        roas: c.roas,
        primary_result: c.primary_result,
        ctr_link: c.ctr_link,
        cpc_link: c.cpc_link,
        cpm: c.cpm,
        frequency: c.frequency,
        roasTarget,
      }).status;
    }
    let points = statusPoints[status];
    if (c.family === "sales" && c.roas != null && status === "atenção" && c.roas < roasTarget * 0.7) {
      points = 58;
    }
    weighted += c.spend * points;
    totalSpend += c.spend;
  }
  let score = totalSpend > 0 ? Math.round(weighted / totalSpend) : 50;

  const delivery = facts?.delivery_summary as { pctSpendNonOptimized?: number } | undefined;
  if (delivery?.pctSpendNonOptimized != null && delivery.pctSpendNonOptimized >= 20) {
    const penalty = Math.min(7, Math.round(delivery.pctSpendNonOptimized * 0.2));
    score -= penalty;
  }

  const funnel = facts?.conversion_funnel as { bottleneck?: string } | undefined;
  if (funnel?.bottleneck === "checkout") {
    score -= 10;
  }

  const clamped = Math.max(0, Math.min(100, score));
  const scoreLabel =
    clamped >= 90
      ? "Excelente"
      : clamped >= 70
        ? "Bom"
        : clamped >= 50
          ? "Regular"
          : clamped >= 30
            ? "Crítico"
            : "Emergência";
  return { score: clamped, scoreLabel };
}

export function deriveScoreV2(
  facts: Record<string, unknown> | null | undefined,
): { score: number; scoreLabel: string } {
  return deriveAccountScore(facts);
}
