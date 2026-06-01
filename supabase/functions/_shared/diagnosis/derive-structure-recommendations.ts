import {
  findDuplicateAudienceTargeting,
  summarizeAdsetTargeting,
} from "./derive-adset-targeting.ts";
import type { MetaRecommendationRow } from "./meta-senior-types.ts";

function mapApiRecommendation(row: Record<string, unknown>): MetaRecommendationRow | null {
  const title =
    String(row.title ?? row.recommendation_type ?? "").trim() ||
    String((row.recommendation_content as Record<string, unknown>)?.title ?? "").trim();
  if (!title) return null;
  const body =
    String(row.description ?? row.message ?? "").trim() ||
    String((row.recommendation_content as Record<string, unknown>)?.body ?? "").trim() ||
    title;
  const impact = Number(row.importance ?? row.impact_score ?? 2);
  return {
    id: `api-${String(row.id ?? title).slice(0, 40)}`,
    title: title.slice(0, 120),
    body: body.slice(0, 400),
    impactPoints: Number.isFinite(impact) ? Math.min(10, Math.max(1, Math.round(impact))) : 2,
    priority: impact >= 4 ? "urgent" : impact >= 3 ? "high" : "medium",
    source: "api",
  };
}

function hasManualAudience(targeting: unknown): boolean {
  if (!targeting || typeof targeting !== "object") return false;
  const t = targeting as Record<string, unknown>;
  if (Array.isArray(t.custom_audiences) && t.custom_audiences.length > 0) return true;
  if (Array.isArray(t.flexible_spec) && t.flexible_spec.length > 0) return true;
  const automation = t.targeting_automation as Record<string, unknown> | undefined;
  if (automation?.advantage_audience === 1 || automation?.advantage_audience === true) {
    return false;
  }
  return Boolean(t.geo_locations);
}

export function deriveStructureRecommendations(
  facts: Record<string, unknown> | null | undefined,
  apiRows: Record<string, unknown>[] | undefined,
): MetaRecommendationRow[] {
  const fromApi = (apiRows ?? [])
    .map(mapApiRecommendation)
    .filter((r): r is MetaRecommendationRow => r != null);

  if (fromApi.length) {
    return fromApi.sort((a, b) => b.impactPoints - a.impactPoints).slice(0, 8);
  }

  const heuristics: MetaRecommendationRow[] = [];
  const adsets = Array.isArray(facts?.adsets_config)
    ? (facts!.adsets_config as Record<string, unknown>[])
    : Array.isArray(facts?.adsets_targeting_sample)
      ? (facts!.adsets_targeting_sample as Record<string, unknown>[])
      : [];

  const targetingRows = summarizeAdsetTargeting(adsets);
  const dups = findDuplicateAudienceTargeting(targetingRows);
  if (dups.length) {
    const d = dups[0];
    heuristics.push({
      id: "fragment-adsets",
      title: "Unificar conjuntos de anúncios similares",
      body: `${d.adset_ids.length} conjuntos na mesma campanha com público sobreposto — concentra orçamento e acelera a fase de aprendizado.`,
      impactPoints: 5,
      priority: "urgent",
      source: "heuristic",
    });
  }

  const manualCount = adsets.filter((a) => hasManualAudience(a.targeting)).length;
  if (manualCount >= 2) {
    heuristics.push({
      id: "advantage-plus-off",
      title: "Advantage+ audience desativado em vários conjuntos",
      body: `${manualCount} conjunto(s) com segmentação manual restrita — testar Advantage+ audience mantendo geo e idade mínima.`,
      impactPoints: 2,
      priority: "high",
      source: "heuristic",
    });
  }

  const ads = Array.isArray(facts?.ads_insights_auction)
    ? (facts!.ads_insights_auction as Record<string, unknown>[])
    : Array.isArray(facts?.ads_insights_top)
      ? (facts!.ads_insights_top as Record<string, unknown>[])
      : [];
  const hasVideoSignal = ads.some((a) => {
    const v = a.video_3_sec_watched_actions;
    return Array.isArray(v) && v.length > 0;
  });
  if (!hasVideoSignal && ads.length >= 3) {
    heuristics.push({
      id: "no-reels-916",
      title: "Expandir para Reels com vídeo 9:16",
      body: "Pouco ou nenhum sinal de vídeo vertical no top de anúncios — inventário Reels pode reduzir CPR em placements automáticos.",
      impactPoints: 1,
      priority: "medium",
      source: "heuristic",
    });
  }

  const enriched = Array.isArray(facts?.campaigns_enriched)
    ? (facts!.campaigns_enriched as { objective_raw?: string }[])
    : [];
  const catalogLike = enriched.filter((c) =>
    /CATALOG|PRODUCT|SHOP/i.test(String(c.objective_raw ?? "")),
  );
  if (catalogLike.length) {
    heuristics.push({
      id: "catalog-boosting",
      title: "Product set boosting no catálogo",
      body: "Conta com sinal de catálogo — avaliar boosting de conjuntos de produtos nos anúncios dinâmicos.",
      impactPoints: 1,
      priority: "medium",
      source: "heuristic",
    });
  }

  return heuristics.sort((a, b) => b.impactPoints - a.impactPoints).slice(0, 6);
}
