/** Tipos — camada Meta Sênior (Graph API, sem MCP). */

export type RankingLabel =
  | "above_average"
  | "average"
  | "below_average"
  | "bottom_20"
  | "not_available";

export type AuctionAdRow = {
  adId: string;
  adName: string;
  campaignName: string;
  spend: number;
  quality: RankingLabel;
  engagement: RankingLabel;
  conversion: RankingLabel;
  diagnosisPt: string;
  pauseCandidate: boolean;
};

export type AdsetAudienceType =
  | "prospecting"
  | "retargeting"
  | "catalog"
  | "traffic"
  | "awareness"
  | "other";

export type AdsetTrendRow = {
  adsetId: string;
  adsetName: string;
  campaignName: string;
  audienceType: AdsetAudienceType;
  ctrNow: number;
  ctrPrev: number;
  ctrChangePct: number | null;
  trend: "good" | "bad" | "flat";
};

export type MetaRecommendationRow = {
  id: string;
  title: string;
  body: string;
  impactPoints: number;
  priority: "urgent" | "high" | "medium";
  source: "api" | "heuristic";
};

export type FunnelHealthAxis =
  | "prospecting_ctr"
  | "conversion"
  | "retargeting_ctr"
  | "structure"
  | "placements"
  | "awareness";

export type FunnelHealthRow = {
  axis: FunnelHealthAxis;
  label: string;
  status: "critical" | "attention" | "ok";
  note: string;
};

export type MetaSeniorDerived = {
  generatedAt: string;
  auctionDiagnostics: AuctionAdRow[];
  adsetTrends: AdsetTrendRow[];
  recommendations: MetaRecommendationRow[];
  funnelHealth: FunnelHealthRow[];
  opportunityScore: number;
  accountSummary: {
    mixedFunnel: boolean;
    primaryObjectiveLabel: string;
    anomalyCount: number;
  };
};
