import { num } from "./campaign-objective.ts";
import type { AuctionAdRow, RankingLabel } from "./meta-senior-types.ts";

function parseRanking(raw: unknown): RankingLabel {
  const s = String(raw ?? "").toUpperCase();
  if (!s || (s.includes("NOT") && s.includes("AVAILABLE"))) return "not_available";
  if (s.includes("BOTTOM") && s.includes("20")) return "bottom_20";
  if (s.includes("BELOW")) return "below_average";
  if (s.includes("ABOVE")) return "above_average";
  if (s.includes("AVERAGE")) return "average";
  return "not_available";
}

function rankingLabelPt(r: RankingLabel): string {
  const m: Record<RankingLabel, string> = {
    above_average: "Acima da média",
    average: "Média",
    below_average: "Abaixo da média",
    bottom_20: "Bottom 20%",
    not_available: "Indisponível",
  };
  return m[r];
}

function buildDiagnosis(
  quality: RankingLabel,
  engagement: RankingLabel,
  conversion: RankingLabel,
): string {
  if (conversion === "bottom_20" && engagement === "above_average") {
    return "Engaja mas não converte.";
  }
  if (conversion === "bottom_20") {
    return "O anúncio não está produzindo conversões.";
  }
  if (
    quality === "above_average" &&
    engagement === "above_average" &&
    conversion === "above_average"
  ) {
    return "Desempenho sólido no leilão.";
  }
  if (quality === "not_available" && engagement === "not_available") {
    return "Rankings ainda não disponíveis para o período.";
  }
  return "Monitorar evolução dos rankings.";
}

export function deriveAuctionDiagnostics(
  ads: Record<string, unknown>[] | undefined,
  minSpendForPause = 50,
): AuctionAdRow[] {
  if (!ads?.length) return [];

  const sorted = [...ads].sort((a, b) => (num(b.spend) ?? 0) - (num(a.spend) ?? 0));

  return sorted.slice(0, 40).map((row) => {
    const quality = parseRanking(row.quality_ranking);
    const engagement = parseRanking(row.engagement_rate_ranking);
    const conversion = parseRanking(row.conversion_rate_ranking);
    const spend = num(row.spend) ?? 0;
    const pauseCandidate =
      spend >= minSpendForPause &&
      (conversion === "bottom_20" || conversion === "below_average");

    const diagnosisPt = buildDiagnosis(quality, engagement, conversion);

    return {
      adId: String(row.ad_id ?? ""),
      adName: String(row.ad_name ?? "Anúncio").slice(0, 120),
      campaignName: String(row.campaign_name ?? "").slice(0, 80),
      spend,
      quality,
      engagement,
      conversion,
      diagnosisPt,
      pauseCandidate,
    };
  });
}

export function formatAuctionRankingPt(r: RankingLabel): string {
  return rankingLabelPt(r);
}
