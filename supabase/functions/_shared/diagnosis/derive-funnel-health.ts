import type {
  AuctionAdRow,
  AdsetTrendRow,
  FunnelHealthRow,
  MetaRecommendationRow,
} from "./meta-senior-types.ts";

export function deriveFunnelHealth(
  adsetTrends: AdsetTrendRow[],
  auction: AuctionAdRow[],
  recommendations: MetaRecommendationRow[],
): FunnelHealthRow[] {
  const prospecting = adsetTrends.filter((t) => t.audienceType === "prospecting");
  const retargeting = adsetTrends.filter((t) => t.audienceType === "retargeting");

  const prospectingBad =
    prospecting.filter((t) => t.trend === "bad").length >=
    Math.max(1, Math.ceil(prospecting.length / 2));
  const retargetingGood = retargeting.some((t) => t.trend === "good" && (t.ctrChangePct ?? 0) > 20);
  const retargetingBad = retargeting.filter((t) => t.trend === "bad").length >= 2;

  const pauseAds = auction.filter((a) => a.pauseCandidate);
  const bestAwareness = auction.find(
    (a) => a.quality === "above_average" && a.engagement === "above_average",
  );

  const hasFragment = recommendations.some((r) => r.id === "fragment-adsets");
  const hasPlacements = recommendations.some((r) => r.id === "no-reels-916");

  const rows: FunnelHealthRow[] = [
    {
      axis: "prospecting_ctr",
      label: "Prospecção (CTR)",
      status: prospectingBad ? "critical" : prospecting.length ? "attention" : "ok",
      note: prospectingBad
        ? "Queda generalizada no CTR de prospecção"
        : "CTR de prospecção estável ou em melhora",
    },
    {
      axis: "conversion",
      label: "Conversão (CVR)",
      status: pauseAds.length >= 2 ? "critical" : pauseAds.length ? "attention" : "ok",
      note: pauseAds.length
        ? `${pauseAds.length} criativo(s) no bottom 20% de conversão`
        : "Sem criativos críticos no leilão",
    },
    {
      axis: "retargeting_ctr",
      label: "Retargeting (CTR)",
      status: retargetingGood && retargetingBad
        ? "attention"
        : retargetingBad
          ? "attention"
          : retargetingGood
            ? "ok"
            : "ok",
      note: retargetingGood && retargetingBad
        ? "Misto — alguns conjuntos sobem, outros caem"
        : retargetingBad
          ? "Retargeting com queda de CTR"
          : retargetingGood
            ? "Retargeting com tração positiva"
            : "Poucos dados de retargeting no período",
    },
    {
      axis: "structure",
      label: "Estrutura de conta",
      status: hasFragment ? "attention" : "ok",
      note: hasFragment
        ? "Fragmentação de ad sets + oportunidade de consolidar"
        : "Sem sinal forte de fragmentação",
    },
    {
      axis: "placements",
      label: "Placements",
      status: hasPlacements ? "attention" : "ok",
      note: hasPlacements
        ? "Sem Reels 9:16 ou placements automáticos limitados"
        : "Cobertura de formatos aceitável",
    },
    {
      axis: "awareness",
      label: "Awareness (reach)",
      status: bestAwareness ? "ok" : "attention",
      note: bestAwareness
        ? `${bestAwareness.adName.slice(0, 40)} com qualidade acima da média`
        : "Sem criativo de awareness destacado no leilão",
    },
  ];

  return rows;
}

export function computeOpportunityScore(funnel: FunnelHealthRow[]): number {
  let score = 88;
  for (const f of funnel) {
    if (f.status === "critical") score -= 12;
    else if (f.status === "attention") score -= 5;
  }
  return Math.max(35, Math.min(95, score));
}
