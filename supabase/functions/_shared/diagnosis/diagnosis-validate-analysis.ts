import type { GrowthIntelligenceDerived } from "./derive-growth-intelligence.ts";

const DASHBOARD_PHRASES = [
  /ctr abaixo do ideal/i,
  /frequência alta na conta/i,
  /roas baixo(?!\s+(em|na|no))/i,
  /métricas abaixo do benchmark/i,
  /desempenho abaixo do esperado/i,
];

const CHAPTER_IDS = [
  "structure",
  "audience",
  "creative",
  "scale",
  "financial",
] as const;

function issueText(issue: Record<string, unknown>): string {
  return [
    issue.title,
    issue.description,
    issue.cause,
    issue.consequence,
    issue.conclusion,
  ]
    .map((x) => String(x ?? ""))
    .join(" ")
    .toLowerCase();
}

function hasLearningFailInFacts(facts: Record<string, unknown> | null | undefined): boolean {
  const rows = (facts?.adset_learning_status ??
    (facts?.consultative_derived as { deliverySummary?: unknown } | undefined)) as
    | { learning_status?: string }[]
    | undefined;
  if (!Array.isArray(rows)) {
    const consult = facts?.consultative_derived as
      | { deliverySummary?: { learningFailCount?: number } }
      | undefined;
    return (consult?.deliverySummary?.learningFailCount ?? 0) > 0;
  }
  return rows.some((r) => r.learning_status === "learning_fail");
}

function mentionsMoney(text: string): boolean {
  return /r\$\s*[\d.,]+|reais|mil\/mês|\/mês/i.test(text);
}

export function validateAnalysisBasics(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.score !== "number") return false;
  if (typeof o.summary !== "string") return false;
  if (typeof o.narrativeHook !== "string" || !o.narrativeHook.trim()) return false;
  if (typeof o.verdictLine !== "string" || !String(o.verdictLine).trim()) return false;
  if (!Array.isArray(o.criticalIssues) || o.criticalIssues.length < 1) return false;
  if (!Array.isArray(o.actionPlan)) return false;
  if (typeof o.disclaimer !== "string") return false;
  const ex = o.executiveSummary as Record<string, unknown> | undefined;
  if (!ex || !Array.isArray(ex.strengths) || !Array.isArray(ex.risks)) return false;
  return true;
}

/** Valida tom consultivo sênior (além de JSON válido). */
export function validateConsultativeNarrative(
  obj: Record<string, unknown>,
  facts?: Record<string, unknown> | null,
): boolean {
  const verdict = String(obj.verdictLine ?? "");
  if (verdict.length < 40 || verdict.length > 220) return false;

  const gi = facts?.growth_intelligence_derived as
    | GrowthIntelligenceDerived
    | undefined;
  const leaks = gi?.moneyLeaks ?? [];
  const gap = gi?.executiveImpact?.gapMonthlyBrl ?? 0;

  if ((leaks.length > 0 || gap > 500) && !mentionsMoney(verdict)) {
    return false;
  }

  const issues = (obj.criticalIssues as Record<string, unknown>[] | undefined) ?? [];
  if (issues.length < 1) return false;

  const firstIssue = issues[0];
  if (!firstIssue || issueText(firstIssue).length < 50) return false;

  for (const phrase of DASHBOARD_PHRASES) {
    if (phrase.test(verdict)) return false;
    if (phrase.test(String(obj.summary ?? ""))) return false;
  }

  if (hasLearningFailInFacts(facts ?? null)) {
    const topTexts = issues.slice(0, 2).map(issueText).join(" ");
    const blamesSaturationOnly =
      /satura(ção|da)|público esgotado|audiência esgotada/i.test(topTexts) &&
      !/aprend|learning|algoritmo|consolidar|volume|orçamento/i.test(topTexts);
    if (blamesSaturationOnly) return false;
  }

  if (leaks.length > 0) {
    const lead = leaks[0];
    const leadLabel = (lead.entityName ?? lead.title ?? "").toLowerCase().trim();
    if (leadLabel.length >= 4) {
      const token = leadLabel.split(/\s+/).find((w) => w.length >= 4) ?? leadLabel;
      const cited = issues.some((issue) => issueText(issue).includes(token.slice(0, 8)));
      if (!cited && !issueText(firstIssue).includes("conjunto") &&
        !issueText(firstIssue).includes("campanha")) {
        return false;
      }
    }
  }

  const chapters = obj.chapterNarratives as Record<string, unknown> | undefined;
  if (!chapters || typeof chapters !== "object") return false;
  for (const id of CHAPTER_IDS) {
    const ch = chapters[id];
    if (typeof ch !== "string" || ch.trim().length < 40) return false;
  }

  const summary = String(obj.summary ?? "");
  if (summary.length < 120) return false;

  return true;
}

export function validateAnalysisQuality(
  obj: Record<string, unknown>,
  facts?: Record<string, unknown> | null,
): boolean {
  if (!validateAnalysisBasics(obj)) return false;

  const issues = obj.criticalIssues as unknown[];
  const gi = facts?.growth_intelligence_derived as
    | GrowthIntelligenceDerived
    | undefined;
  const leaks = gi?.moneyLeaks ?? [];
  if (leaks.length > 0 && issues.length < 1) return false;

  const funnel = (facts?.conversion_funnel ??
    (facts?.consultative_derived as { conversionFunnel?: { bottleneck?: string } } | undefined)
      ?.conversionFunnel) as { bottleneck?: string } | undefined;
  const bottleneck = funnel?.bottleneck ?? "";
  if (/checkout/i.test(bottleneck)) {
    const hasCheckoutIssue = issues.some((item) => {
      if (!item || typeof item !== "object") return false;
      const i = item as Record<string, unknown>;
      const axis = String(i.axis ?? "");
      const text = issueText(i);
      return axis === "structure" || /checkout|site|pagamento|gateway/.test(text);
    });
    if (!hasCheckoutIssue) return false;
  }

  return validateConsultativeNarrative(obj, facts);
}

export function validateAnalysis(
  obj: unknown,
  facts?: Record<string, unknown> | null,
): boolean {
  if (!obj || typeof obj !== "object") return false;
  return validateAnalysisQuality(obj as Record<string, unknown>, facts);
}
