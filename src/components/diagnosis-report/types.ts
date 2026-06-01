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
  }[];
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
  actionPlan?: {
    step: number;
    action: string;
    impact: string;
    eta: string;
    engine?: string;
    relatedAxis?: string;
  }[];
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
  maturity?: MaturityScore;
  leakByAxis?: LeakByAxisItem[];
  growthScenarios?: GrowthScenarios;
  chapterNarratives?: ChapterNarratives;
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
  conservativeFormatted: string;
  probableFormatted: string;
  aggressiveFormatted: string;
  basisNote: string;
  confidence: "low" | "medium";
  revenueFormatted?: string | null;
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
