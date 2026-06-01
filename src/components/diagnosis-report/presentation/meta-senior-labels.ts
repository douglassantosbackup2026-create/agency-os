import type { AdsetAudienceType, RankingLabel } from "../types";

export function rankingLabelPt(r: RankingLabel): string {
  const m: Record<RankingLabel, string> = {
    above_average: "Acima da média",
    average: "Média",
    below_average: "Abaixo da média",
    bottom_20: "Bottom 20%",
    not_available: "—",
  };
  return m[r] ?? "—";
}

export function audienceTypePt(t: AdsetAudienceType): string {
  const m: Record<AdsetAudienceType, string> = {
    prospecting: "Prospecção",
    retargeting: "Retargeting",
    catalog: "Catálogo",
    traffic: "Tráfego",
    awareness: "Awareness",
    other: "Outro",
  };
  return m[t] ?? t;
}

export function funnelStatusClass(status: string): string {
  if (status === "critical") return "severity-critical";
  if (status === "attention") return "severity-high";
  return "severity-medium";
}
