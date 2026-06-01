import type {
  DiagnosisAnalysis,
  FinancialBalance,
  TopFinding,
} from "@/components/diagnosis-report/types";

export function buildClientTopFindings(analysis: DiagnosisAnalysis): TopFinding[] {
  if (analysis.topFindings?.length) return analysis.topFindings;

  const findings: TopFinding[] = [];
  const fi = analysis.financialImpact;

  for (const line of fi?.wasteLines ?? []) {
    if (findings.length >= 3) break;
    const name = line.campaignNames[0] ?? "Campanha";
    findings.push({
      rank: findings.length + 1,
      severity: "warning",
      campaignName: name,
      objectiveFamily: "mix",
      kpiStatus: "atenção",
      monthlyImpactBrl: line.monthlyBrl,
      monthlyImpactFormatted: formatBrl(line.monthlyBrl),
      headline: `${line.label} — ${formatBrl(line.monthlyBrl)}/mês`,
      actionHint: "Revisar campanhas citadas no relatório.",
      evidence: line.campaignNames.slice(0, 3).join(", "),
    });
  }

  for (const issue of analysis.criticalIssues ?? []) {
    if (findings.length >= 3) break;
    if (findings.some((f) => f.campaignName === issue.title)) continue;
    findings.push({
      rank: findings.length + 1,
      severity: /alta|high|crítica/i.test(issue.priority) ? "critical" : "warning",
      campaignName: issue.title,
      objectiveFamily: "—",
      kpiStatus: "atenção",
      monthlyImpactBrl: 0,
      monthlyImpactFormatted: "—",
      headline: issue.title,
      actionHint: issue.description.slice(0, 160),
      evidence: issue.financialNote ?? issue.description.slice(0, 120),
    });
  }

  return findings.map((f, i) => ({ ...f, rank: i + 1 }));
}

export function buildClientFinancialBalance(
  analysis: DiagnosisAnalysis,
): FinancialBalance | null {
  if (analysis.financialBalance) return analysis.financialBalance;
  const fi = analysis.financialImpact;
  if (!fi?.spendFormatted) return null;

  const invested = fi.lossMonthlyBrl != null ? 0 : 0;
  return {
    invested30d: invested,
    investedFormatted: fi.spendFormatted,
    revenue30d: null,
    revenueFormatted: fi.revenueFormatted ?? "—",
    mediaProfit30d: null,
    mediaProfitFormatted: fi.mediaProfitFormatted ?? "—",
    atRisk30d: fi.lossMonthlyBrl ?? 0,
    atRiskFormatted: fi.lossMonthlyFormatted ?? "—",
    recoverableConservative: fi.recoveryConservativeBrl ?? 0,
    recoverableOptimistic: fi.recoveryOptimisticBrl ?? 0,
    recoverableConservativeFormatted: fi.recoveryConservativeFormatted ?? "—",
    recoverableOptimisticFormatted: fi.recoveryOptimisticFormatted ?? "—",
    netPositionLabel:
      analysis.storyExecutive?.headline ??
      analysis.summary.slice(0, 180),
    allocationNote: fi.recoveryBasisNote ?? analysis.summary.slice(0, 200),
  };
}

function formatBrl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export const PROMPT_VERSION_V10 = "diagnosis-ecommerce-v10";

export function isLegacyReport(promptVersion: string | null | undefined): boolean {
  if (!promptVersion) return true;
  return promptVersion !== PROMPT_VERSION_V10;
}
