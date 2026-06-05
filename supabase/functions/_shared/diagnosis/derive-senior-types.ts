/** Tipos compartilhados — Analista Sênior (v12). */

export type ChapterStatus = "good" | "warning" | "critical" | "info" | "na";
export type LeakAxis = "structure" | "audience" | "creative" | "sales";
export type DiagnosticChapterId = "structure" | "audience" | "creative" | "scale" | "financial";
export type RiskSeverity = "critical" | "warning" | "info";

export type DiagnosticChapter = {
  id: DiagnosticChapterId;
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
  axis: LeakAxis;
  axisLabel: string;
  monthlyBrl: number;
  monthlyFormatted: string;
  severity: RiskSeverity;
  headline: string;
  evidence: string;
};

export type GrowthScenarios = {
  conservativePct: number;
  probablePct: number;
  aggressivePct: number;
  conservativeMonthlyBrl: number;
  probableMonthlyBrl: number;
  aggressiveMonthlyBrl: number;
  conservativeFormatted: string;
  probableFormatted: string;
  aggressiveFormatted: string;
  basisNote: string;
  confidence: "low" | "medium";
  revenueFormatted?: string | null;
};

export type SeniorRisk = {
  id: string;
  title: string;
  severity: RiskSeverity;
  evidence: string;
  relatedAxis: LeakAxis | "scale" | null;
};

export type SeniorDerived = {
  maturity: MaturityScore;
  leakByAxis: LeakByAxisItem[];
  growthScenarios: GrowthScenarios;
  diagnostics: Record<DiagnosticChapterId, DiagnosticChapter>;
  risks: SeniorRisk[];
};
