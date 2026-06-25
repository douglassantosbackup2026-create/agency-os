export type TopFindingSeverity = "critical" | "warning" | "info";

export type TopFinding = {
  rank: number;
  severity: TopFindingSeverity;
  campaignName: string;
  objectiveFamily: string;
  kpiStatus: string;
  monthlyImpactBrl: number;
  monthlyImpactFormatted: string;
  headline: string;
  actionHint: string;
  evidence: string;
};

export type FinancialBalance = {
  invested30d: number;
  investedFormatted: string;
  revenue30d: number | null;
  revenueFormatted: string;
  mediaProfit30d: number | null;
  mediaProfitFormatted: string;
  atRisk30d: number;
  atRiskFormatted: string;
  recoverableConservative: number;
  recoverableOptimistic: number;
  recoverableConservativeFormatted: string;
  recoverableOptimisticFormatted: string;
  netPositionLabel: string;
  allocationNote: string;
};

export type BenchmarkGap = {
  metric: string;
  current: string;
  reference: string;
  status: string;
  gapNote: string;
  deltaLabel?: string;
  deltaPct?: number | null;
  isBad?: boolean;
};

export type DiagnosisAnalysis = {
  score: number;
  scoreLabel: string;
  verdictLine?: string;
  narrativeHook?: string;
  executiveSummary?: {
    strengths?: string[];
    risks?: string[];
    oneLiner?: string;
  };
  summary: string;
  topFindings?: TopFinding[];
  financialBalance?: FinancialBalance;
  financialImpact?: {
    spendFormatted?: string;
    revenueFormatted?: string;
    roasFormatted?: string;
    mediaProfitFormatted?: string;
    lossMonthlyBrl?: number;
    lossMonthlyFormatted?: string;
    primaryGapMonthlyBrl?: number;
    primaryGapMonthlyFormatted?: string;
    heroRangeFormatted?: string;
    heroValueFormatted?: string;
    recoveryConservativeBrl?: number;
    recoveryOptimisticBrl?: number;
    recoveryConservativeFormatted?: string;
    recoveryOptimisticFormatted?: string;
    recoveryBasisNote?: string;
    recoveryConfidence?: string;
    paretoAds?: { note: string } | null;
    wasteLines?: { label: string; monthlyBrl: number; campaignNames: string[] }[];
  };
  storyExecutive?: {
    headline?: string;
    lossMonthlyFormatted?: string;
    recoveryRangeFormatted?: string;
    heroRangeFormatted?: string;
    problemCount?: number;
    quickWinCount?: number;
  };
  scoreExplanation?: {
    formulaNote?: string;
    pillars?: { id: string; label: string; value: string; detail: string }[];
  };
  benchmarkComparison?: {
    nicheLabel?: string;
    gaps?: BenchmarkGap[];
  };
  metrics?: {
    name: string;
    current: string;
    reference: string;
    status: string;
  }[];
  criticalIssues?: {
    title: string;
    description: string;
    priority: string;
    cause?: string;
    consequence?: string;
    financialNote?: string | null;
    axis?: "structure" | "audience" | "creative" | "sales" | null;
    engine?: "leak" | "growth" | "risk" | null;
    hypothesisId?: string;
    confidence?: "high" | "medium" | "needs_data";
    evidenceFor?: string[];
    evidenceAgainst?: string[];
    conclusion?: string;
  }[];
  hypothesisSeeds?: HypothesisSeed[];
  prioritizedActions?: PrioritizedAction[];
  mondayActions?: PrioritizedAction[];
  budgetLeaks?: {
    title: string;
    estimateNote: string;
    hint: string;
    monthlyBrl?: number | null;
  }[];
  opportunities?: {
    title: string;
    potentialNote: string;
    complexity: string;
  }[];
  creativesSummary?: { best: string | null; worst: string | null; recommendation: string };
  audiencesSummary?: { segmentation: string; notes: string[] };
  structureNotes?: string[];
  actionPlan?: PrioritizedAction[];
  improvementScenario?: { note: string; confidence: string };
  campaignBreakdown?: {
    name: string;
    spend: string;
    roas: string;
    ctr: string;
    cpm: string;
    frequency: string;
    status: string;
    objective_label?: string;
    result_label?: string;
    results_count?: string;
    cost_per_result?: string;
    status_reason?: string;
  }[];
  accountObjectiveSummary?: {
    mixed_funnel: boolean;
    sales_block: {
      spend_formatted: string;
      roas_formatted: string;
      cpa_formatted: string;
      campaign_count: number;
    } | null;
    by_family: {
      family: string;
      label: string;
      spend_pct: number;
      spend_formatted: string;
      headline_kpi: string;
    }[];
  };
  accountContextMetrics?: {
    name: string;
    current: string;
    reference: string;
    status: string;
  }[];
  dataLimitations?: string[];
  disclaimer?: string;
  seniorDerived?: SeniorDerived;
  metaSenior?: MetaSeniorDerived;
  consultativeDerived?: ConsultativeDerived;
  growthIntelligenceDerived?: GrowthIntelligenceDerived;
  executiveConclusion?: ExecutiveConclusion;
  maturity?: MaturityScore;
  leakByAxis?: LeakByAxisItem[];
  growthScenarios?: GrowthScenarios;
  chapterNarratives?: ChapterNarratives;
  __meta?: {
    provider?: string;
    model?: string;
    narrative_source?: "ai" | "deterministic";
    prompt_version?: string;
    generated_at?: string;
  };
};

export type ChapterStatus = "good" | "warning" | "critical" | "info" | "na";

export type DiagnosticChapter = {
  id: "structure" | "audience" | "creative" | "scale" | "financial";
  title: string;
  status: ChapterStatus;
  headline: string;
  evidence: string;
  impactNote: string | null;
  dataAvailable: "full" | "partial" | "none";
};

export type MaturityPillar = {
  id: string;
  label: string;
  score: number;
  detail: string;
};

export type MaturityScore = {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  summary: string;
  pillars: MaturityPillar[];
};

export type LeakByAxisItem = {
  axis: "structure" | "audience" | "creative" | "sales";
  axisLabel: string;
  monthlyBrl: number;
  monthlyFormatted: string;
  severity: "critical" | "warning" | "info";
  headline: string;
  evidence: string;
};

export type GrowthScenarios = {
  conservativePct: number;
  probablePct: number;
  aggressivePct: number;
  conservativeMonthlyBrl?: number;
  probableMonthlyBrl?: number;
  aggressiveMonthlyBrl?: number;
  conservativeFormatted: string;
  probableFormatted: string;
  aggressiveFormatted: string;
  basisNote: string;
  confidence: "low" | "medium";
  revenueFormatted?: string | null;
};

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

export type FunnelHealthRow = {
  axis: string;
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

export type AccountFinancialGap = {
  periodLabel: string;
  investedFormatted: string;
  revenueActualFormatted: string;
  roasActualFormatted: string;
  roasReferenceFormatted: string;
  revenuePotentialFormatted: string;
  gapMonthlyFormatted: string;
  gapAnnualFormatted: string;
  nicheLabel: string;
  headlinePt: string;
  gapMonthlyBrl: number;
};

export type DeliverySummary = {
  totalAdsets: number;
  pctSpendNonOptimized: number;
  spendNonOptimizedFormatted: string;
  estimatedDailyBlindSpendFormatted: string;
  summaryPt: string;
  byStatus: Record<string, number>;
};

export type ConversionFunnelView = {
  lpv: number;
  atc: number;
  checkout: number;
  paymentInfo?: number;
  purchase: number;
  atcRate: number | null;
  checkoutRate: number | null;
  paymentInfoRate?: number | null;
  purchaseFromPaymentRate?: number | null;
  purchaseRate: number | null;
  paymentInfoTracked?: boolean;
  bottleneck: string;
  bottleneckLabel: string;
  bottleneckDetail?: string | null;
  revenueAtRiskMonthlyBrl: number | null;
};

export type AdsetBleedRow = {
  adsetName: string;
  campaignName: string;
  bleedFormatted: string;
  bleedBrl: number;
  roasFormatted: string;
  spendFormatted: string;
  learningStatus?: string;
};

export type AdVideoDiagnostic = {
  adName: string;
  campaignName: string;
  roas: number | null;
  hookRatePct: number | null;
  diagnosisPt: string;
  isBestCandidate: boolean;
  isWorstCandidate: boolean;
  pauseCandidate?: boolean;
};

export type WinnerUnderinvested = {
  adName: string;
  roas: number;
  spendNote: string;
  campaignName: string;
};

export type ConsultativeDerived = {
  nicheContext?: { nicheLabel: string; source: string };
  accountFinancialGap?: AccountFinancialGap | null;
  deliverySummary?: DeliverySummary | null;
  conversionFunnel?: ConversionFunnelView | null;
  adsetBleedRanking?: AdsetBleedRow[];
  winnerUnderinvested?: WinnerUnderinvested | null;
  adVideoDiagnostics?: AdVideoDiagnostic[];
};

export type ExecutiveConclusion = {
  isHealthy: boolean;
  primaryProblemDomain: "meta" | "structure" | "mixed";
  moneyLostMonthlyBrl: number | null;
  recoverableMonthlyBrl: number | null;
  generatableMonthlyBrl: number | null;
  scaleNow: "yes" | "no" | "conditional";
  firstDecisionIfIHired: string;
};

export type EvidenceStrength = {
  purchases: number;
  tier: "high" | "medium" | "low";
};

export type LeakTrend = {
  direction: "improving" | "stable" | "deteriorating" | "unknown";
  metric: "roas" | "cpa" | "ctr" | "cpm" | null;
  deltaPct: number | null;
  summaryPt: string | null;
  badge: string;
};

export type MoneyLeakItem = {
  id: string;
  title: string;
  monthlyImpactBrl: number;
  monthlyImpactFormatted: string;
  confidence: string;
  rootCause: string;
  action: string;
  priority: number;
  category: string;
  entityName?: string;
  entityId?: string;
  evidenceStrength?: EvidenceStrength;
  trend?: LeakTrend;
};

export type AccountHealthVerdict = {
  isHealthy: boolean;
  reasons: string[];
};

export type GrowthIntelligenceDerived = {
  executiveImpact: {
    investedFormatted: string;
    revenueActualFormatted: string;
    roasActualFormatted: string;
    gapMonthlyFormatted: string;
    headlinePt: string;
    gapMonthlyBrl?: number;
    gapAnnualBrl?: number;
  };
  moneyLeaks: MoneyLeakItem[];
  growthOpportunities: {
    id: string;
    title: string;
    potentialFormatted: string;
    whyExists: string;
    howToCapture: string;
    estimatedEta: string;
    evidenceStrength?: EvidenceStrength;
  }[];
  risks: {
    id: string;
    title: string;
    severity: string;
    evidence: string;
    potentialImpactFormatted: string;
  }[];
  benchmarkImpacts: {
    metric: string;
    current: string;
    reference: string;
    tierNote: string;
    estimatedImpactFormatted: string;
  }[];
  maturity: {
    score0to100: number;
    enterpriseLabel: string;
    summary: string;
    blockersToNextLevel: string[];
    pillars: MaturityPillar[];
  };
  decisionActions: {
    step: number;
    action: string;
    impactFormatted: string;
    priorityScore: number;
    eta: string;
  }[];
  projections: {
    disclaimer: string;
    scenarios: {
      key: string;
      label: string;
      revenueUpliftFormatted: string;
      additionalRevenueFormatted: string;
      estimatedEta: string;
    }[];
  };
  accountHealth?: AccountHealthVerdict;
  accountTrend?: LeakTrend | null;
};

export type SeniorDerived = {
  maturity: MaturityScore;
  leakByAxis: LeakByAxisItem[];
  growthScenarios: GrowthScenarios;
  diagnostics: Record<
    "structure" | "audience" | "creative" | "scale" | "financial",
    DiagnosticChapter
  >;
  risks: { id: string; title: string; severity: string; evidence: string }[];
};

export type ChapterNarratives = {
  structure?: string | null;
  audience?: string | null;
  creative?: string | null;
  scale?: string | null;
  financial?: string | null;
};

export type HypothesisSeed = {
  id: string;
  axis: string;
  title: string;
  claim: string;
  evidenceFor: string[];
  evidenceAgainst: string[];
  confidence: "high" | "medium" | "needs_data";
  monthlyBrlHint?: number;
};

export type PrioritizedAction = {
  step: number;
  action: string;
  impact: string;
  eta: string;
  impactBrl: number | null;
  urgency: "now" | "soon" | "later";
  effort: "low" | "medium" | "high";
  relatedAxis: string | null;
  engine: string;
  rationale: string;
};
