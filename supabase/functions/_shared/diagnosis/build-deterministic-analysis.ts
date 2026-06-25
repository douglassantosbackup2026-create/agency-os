import type {
  DecisionActionItem,
  GrowthIntelligenceDerived,
  GrowthOpportunityItem,
  GrowthRiskItem,
  MoneyLeakItem,
} from "./derive-growth-intelligence.ts";
import type { CommercialDerived } from "./derive-commercial.ts";
import type { DiagnosticChapterId } from "./derive-senior-types.ts";
import { buildCommercialDerived } from "./derive-commercial.ts";
import { normalizeAnalysisV2 } from "./derive-analysis.ts";

function mapLeakPriority(leak: MoneyLeakItem): "high" | "medium" | "low" {
  if (leak.priority <= 2) return "high";
  if (leak.priority <= 4) return "medium";
  return "low";
}

function mapLeakAxis(
  category: MoneyLeakItem["category"],
): "structure" | "audience" | "creative" | "sales" | null {
  if (category === "structure" || category === "learning" || category === "budget") {
    return "structure";
  }
  if (category === "audience" || category === "saturation") return "audience";
  if (category === "creative") return "creative";
  if (category === "sales") return "sales";
  return null;
}

function leakToIssue(leak: MoneyLeakItem): Record<string, unknown> {
  return {
    title: leak.title,
    description: `${leak.rootCause} Impacto estimado: ${leak.monthlyImpactFormatted}/mês.`,
    cause: leak.rootCause,
    consequence: leak.action,
    financialNote: leak.monthlyImpactFormatted,
    priority: mapLeakPriority(leak),
    axis: mapLeakAxis(leak.category),
    engine: "leak",
    hypothesisId: leak.id,
    confidence: leak.confidence,
    evidenceFor: [leak.rootCause],
    evidenceAgainst: [],
    conclusion: leak.action,
  };
}

function riskToIssue(risk: GrowthRiskItem): Record<string, unknown> {
  const priority =
    risk.severity === "critical" || risk.severity === "high"
      ? "high"
      : risk.severity === "medium"
        ? "medium"
        : "low";
  return {
    title: risk.title,
    description: risk.evidence,
    cause: risk.evidence,
    consequence: risk.potentialImpactFormatted
      ? `Impacto potencial: ${risk.potentialImpactFormatted}.`
      : "Pode reduzir eficiência e previsibilidade do retorno.",
    financialNote: risk.potentialImpactFormatted,
    priority,
    axis: null,
    engine: "risk",
    hypothesisId: risk.id,
    confidence: risk.severity === "critical" ? "high" : "medium",
    evidenceFor: [risk.evidence],
    evidenceAgainst: [],
    conclusion: "Priorizar mitigação nas próximas 1–2 semanas.",
  };
}

function actionFromDecision(a: DecisionActionItem): Record<string, unknown> {
  return {
    step: a.step,
    action: a.action,
    impact: a.impactFormatted,
    eta: a.eta,
    impactBrl: a.impactBrl,
    urgency: a.urgency,
    effort: a.effort,
    relatedAxis: null,
    engine: "action",
  };
}

function opportunityToEntry(o: GrowthOpportunityItem): Record<string, unknown> {
  return {
    title: o.title,
    potentialNote: `${o.whyExists} ${o.howToCapture}`,
    complexity: o.estimatedEta.includes("dia") ? "quick" : "medium",
  };
}

function chapterNarrativesFromFacts(
  facts: Record<string, unknown>,
): Record<string, string | null> {
  const chapters: DiagnosticChapterId[] = [
    "structure",
    "audience",
    "creative",
    "scale",
    "financial",
  ];
  const senior = facts.senior_derived as
    | { diagnostics?: Record<string, { headline?: string; evidence?: string }> }
    | undefined;
  const commercial = facts.commercial_derived as CommercialDerived | undefined;
  const seniorDiag = senior?.diagnostics ??
    (commercial as { seniorDerived?: { diagnostics?: Record<string, { headline?: string; evidence?: string }> } })
      ?.seniorDerived?.diagnostics;
  const out: Record<string, string | null> = {};
  for (const id of chapters) {
    const ch = seniorDiag?.[id];
    if (ch?.headline) {
      out[id] = [ch.headline, ch.evidence].filter(Boolean).join(" ").slice(0, 600);
    } else {
      out[id] = null;
    }
  }
  return out;
}

/** Skeleton narrativo a partir dos motores — normalizeAnalysisV2 preenche o resto. */
export function buildDeterministicAnalysisSkeleton(
  facts: Record<string, unknown>,
): Record<string, unknown> {
  const commercial =
    (facts.commercial_derived as CommercialDerived | undefined) ??
    buildCommercialDerived(facts);
  const gi = facts.growth_intelligence_derived as
    | GrowthIntelligenceDerived
    | undefined;

  const leaks = gi?.moneyLeaks ?? [];
  const risks = gi?.risks ?? [];
  const issues: Record<string, unknown>[] = [];
  for (const leak of leaks.slice(0, 5)) {
    issues.push(leakToIssue(leak));
  }
  for (const risk of risks) {
    if (issues.length >= 7) break;
    if (issues.some((i) => i.title === risk.title)) continue;
    issues.push(riskToIssue(risk));
  }
  if (issues.length === 0 && commercial.topFindings[0]) {
    const f = commercial.topFindings[0];
    issues.push({
      title: f.campaignName,
      description: f.headline,
      cause: f.evidence,
      consequence: f.actionHint,
      financialNote: f.monthlyImpactFormatted,
      priority: f.severity === "critical" ? "high" : "medium",
      axis: null,
      engine: "leak",
      hypothesisId: `finding-${f.rank}`,
      confidence: "medium",
      evidenceFor: [f.evidence],
      evidenceAgainst: [],
      conclusion: f.actionHint,
    });
  }

  const decisionActions = gi?.decisionActions ?? [];
  const seniorRisks = commercial.seniorDerived?.risks ?? [];
  const actionPlan = decisionActions.length > 0
    ? decisionActions.slice(0, 8).map(actionFromDecision)
    : seniorRisks.slice(0, 5).map((r, i) => ({
        step: i + 1,
        action: `Endereçar: ${r.title}`,
        impact: r.evidence,
        eta: r.severity === "critical" ? "3-5 dias" : "1-2 semanas",
        engine: "risk",
        relatedAxis: r.relatedAxis,
        impactBrl: null,
        urgency: "soon",
        effort: "medium",
      })) ?? [];

  const headline =
    gi?.executiveImpact.headlinePt ??
    commercial.storyExecutive.headline;
  const firstFinding = commercial.topFindings[0];
  const verdictLine = firstFinding
    ? `${firstFinding.headline}. ${commercial.financialBalance.netPositionLabel}`.slice(0, 220)
    : headline.slice(0, 220);

  const opportunities = (gi?.growthOpportunities ?? []).slice(0, 5).map(opportunityToEntry);
  const budgetLeaks = leaks.slice(0, 5).map((l) => ({
    title: l.title,
    estimateNote: l.monthlyImpactFormatted,
    hint: l.action,
    monthlyBrl: l.monthlyImpactBrl,
  }));

  const maturity = gi?.maturity;
  const score = maturity?.score0to100 ?? 50;
  const storyRisks = gi?.risks?.map((r) => r.title).slice(0, 4) ?? [];

  return {
    score,
    scoreLabel: maturity?.enterpriseLabel ?? "Análise automatizada",
    verdictLine,
    narrativeHook: headline.slice(0, 180),
    executiveSummary: {
      strengths: gi?.accountHealth.isHealthy
        ? ["Conta com indicadores dentro do esperado para o período."]
        : [],
      risks: storyRisks,
      oneLiner: commercial.recovery.basisNote,
    },
    summary: [
      headline,
      firstFinding
        ? `${firstFinding.campaignName}: ${firstFinding.monthlyImpactFormatted}/mês em jogo.`
        : null,
      commercial.recovery.basisNote,
      decisionActions[0]?.action ?? actionPlan[0]
        ? String((actionPlan[0] as { action?: string }).action)
        : "Revisar plano de ação prioritário.",
    ]
      .filter(Boolean)
      .join(" "),
    criticalIssues: issues,
    chapterNarratives: chapterNarrativesFromFacts(facts),
    budgetLeaks,
    opportunities,
    creativesSummary: {
      best: null,
      worst: null,
      recommendation:
        "Concentrar verba nos criativos com melhor desempenho no objetivo de cada campanha.",
    },
    audiencesSummary: {
      segmentation: "Ver capítulo de públicos no relatório.",
      notes: [],
    },
    structureNotes: [],
    actionPlan,
    improvementScenario: {
      note: gi?.projections.disclaimer ?? commercial.recovery.basisNote,
      confidence: commercial.recovery.confidence,
    },
    executiveConclusion: {
      isHealthy: gi?.accountHealth.isHealthy ?? false,
      primaryProblemDomain: "mixed",
      moneyLostMonthlyBrl: leaks.reduce((s, l) => s + l.monthlyImpactBrl, 0) || null,
      recoverableMonthlyBrl: commercial.recovery.conservativeMonthlyBrl || null,
      generatableMonthlyBrl: gi?.executiveImpact.gapMonthlyBrl ?? null,
      scaleNow: gi?.accountHealth.isHealthy ? "yes" : "conditional",
      firstDecisionIfIHired:
        decisionActions[0]?.action ??
        String((actionPlan[0] as { action?: string } | undefined)?.action ?? headline),
    },
    disclaimer:
      "Relatório gerado com motores determinísticos a partir dos dados Meta disponíveis. Estimativas em R$ são indicativas e não garantem resultado futuro.",
    dataLimitations: [
      "Narrativa gerada sem camada de IA — números e prioridades vêm dos motores do servidor.",
    ],
  };
}

export function buildDeterministicAnalysis(
  facts: Record<string, unknown>,
): Record<string, unknown> {
  const skeleton = buildDeterministicAnalysisSkeleton(facts);
  return normalizeAnalysisV2(skeleton, facts);
}
