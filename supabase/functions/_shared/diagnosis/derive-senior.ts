import type { CommercialDerived } from "./derive-commercial.ts";
import { deriveAudienceDiagnosis } from "./derive-audience-diagnosis.ts";
import {
  deriveCreativeDiagnosis,
  deriveCreativeDependency,
} from "./derive-creative-diagnosis.ts";
import { deriveGrowthScenarios } from "./derive-growth-scenarios.ts";
import { deriveLeakByAxis } from "./derive-leak-by-axis.ts";
import { deriveMaturityScore } from "./derive-maturity.ts";
import { deriveScaleDiagnosis } from "./derive-scale-diagnosis.ts";
import { deriveStructureDiagnosis } from "./derive-structure-diagnosis.ts";
import type {
  DiagnosticChapter,
  SeniorDerived,
  SeniorRisk,
} from "./derive-senior-types.ts";

export type {
  SeniorDerived,
  MaturityScore,
  LeakByAxisItem,
  GrowthScenarios,
  DiagnosticChapter,
  SeniorRisk,
} from "./derive-senior-types.ts";

function deriveFinancialChapter(commercial: CommercialDerived): DiagnosticChapter {
  const bal = commercial.financialBalance;
  const econ = commercial.accountEconomics;
  let status: DiagnosticChapter["status"] = "info";
  if (bal.atRisk30d >= 3000 || (econ.roasSales != null && econ.roasSales < 1.5)) {
    status = "critical";
  } else if (bal.atRisk30d >= 800) {
    status = "warning";
  } else if (econ.roasSales != null && econ.roasSales >= 2.5) {
    status = "good";
  }

  return {
    id: "financial",
    title: "Diagnóstico financeiro",
    status,
    headline: bal.netPositionLabel,
    evidence: bal.allocationNote,
    impactNote:
      commercial.waste.totalMonthlyBrl > 0
        ? `Recuperação indicativa: ${commercial.recovery.conservativeFormatted} – ${commercial.recovery.optimisticFormatted}/mês`
        : null,
    dataAvailable: econ.spend30d > 0 ? "full" : "partial",
  };
}

function buildRisks(
  facts: Record<string, unknown> | null | undefined,
  commercial: CommercialDerived,
  chapters: {
    structure: DiagnosticChapter;
    audience: DiagnosticChapter;
    creative: DiagnosticChapter;
    scale: DiagnosticChapter;
  },
): SeniorRisk[] {
  const risks: SeniorRisk[] = [];
  const dep = deriveCreativeDependency(facts);

  if (dep?.isHighDependency) {
    risks.push({
      id: "creative-dependency",
      title: "Dependência de um único criativo",
      severity: "critical",
      evidence: `${dep.topAdSpendSharePct}% do gasto no top ad${dep.topAdName ? ` (${dep.topAdName})` : ""}`,
      relatedAxis: "creative",
    });
  }

  if (chapters.audience.status === "critical") {
    risks.push({
      id: "audience-frequency",
      title: "Frequência elevada na conta ou campanhas",
      severity: "warning",
      evidence: chapters.audience.evidence,
      relatedAxis: "audience",
    });
  }

  if (commercial.waste.salesUntrackedSpend >= 500) {
    risks.push({
      id: "tracking-missing",
      title: "Rastreamento de conversões comprometido",
      severity: "critical",
      evidence: `${commercial.waste.salesUntrackedSpend.toFixed(0)} em Vendas sem compras rastreadas`,
      relatedAxis: "sales",
    });
  }

  if (chapters.structure.status === "critical") {
    risks.push({
      id: "structure-fragmented",
      title: "Estrutura de campanhas fragmentada",
      severity: "warning",
      evidence: chapters.structure.evidence,
      relatedAxis: "structure",
    });
  }

  if (commercial.waste.totalMonthlyBrl >= 1000) {
    risks.push({
      id: "waste-high",
      title: "Desperdício mensal elevado",
      severity: commercial.waste.totalMonthlyBrl >= 3000 ? "critical" : "warning",
      evidence: `${commercial.waste.totalFormatted}/mês · ${commercial.waste.lines.length} linha(s)`,
      relatedAxis: "sales",
    });
  }

  return risks.slice(0, 8);
}

export function buildSeniorDerived(
  facts: Record<string, unknown> | null | undefined,
  commercial: CommercialDerived,
  healthScore: number,
): SeniorDerived {
  const structure = deriveStructureDiagnosis(facts);
  const audience = deriveAudienceDiagnosis(facts);
  const creative = deriveCreativeDiagnosis(facts, commercial.benchmarkComparison);
  const scale = deriveScaleDiagnosis(facts);
  const financial = deriveFinancialChapter(commercial);

  const maturity = deriveMaturityScore(facts, commercial, healthScore);
  const leakByAxis = deriveLeakByAxis(commercial, facts, {
    structure,
    audience,
    creative,
  });
  const growthScenarios = deriveGrowthScenarios(commercial);
  const risks = buildRisks(facts, commercial, {
    structure,
    audience,
    creative,
    scale,
  });

  return {
    maturity,
    leakByAxis,
    growthScenarios,
    diagnostics: {
      structure,
      audience,
      creative,
      scale,
      financial,
    },
    risks,
  };
}
