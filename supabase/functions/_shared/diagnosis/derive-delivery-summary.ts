import { num } from "./campaign-objective.ts";
import type { AdsetLearningStatus } from "./derive-analysis.ts";

export type DeliverySummary = {
  totalAdsets: number;
  byStatus: Record<string, number>;
  pctSpendNonOptimized: number;
  spendNonOptimizedFormatted: string;
  estimatedDailyBlindSpendBrl: number;
  estimatedDailyBlindSpendFormatted: string;
  summaryPt: string;
};

function mapSubstatusPt(row: AdsetLearningStatus): string {
  if (row.learning_status === "learning_fail") {
    if (row.learning_limited_reason === "budget") {
      return "budget_limited_learning_fail";
    }
    if (row.learning_limited_reason === "audience") {
      return "audience_limited_learning";
    }
    return "ad_set_learning_exit_unsuccessfully";
  }
  if (row.learning_status === "learning") return "in_learning_phase";
  if (row.learning_status === "active") return "active";
  return "unknown";
}

export function deriveDeliverySummary(
  facts: Record<string, unknown> | null | undefined,
  learningRows: AdsetLearningStatus[],
): DeliverySummary | null {
  if (!learningRows.length) return null;

  const insights = Array.isArray(facts?.adsets_insights)
    ? (facts!.adsets_insights as Record<string, unknown>[])
    : [];
  const spendByAdset = new Map<string, number>();
  for (const r of insights) {
    const id = String(r.adset_id ?? "");
    if (id) spendByAdset.set(id, num(r.spend) ?? 0);
  }

  const byStatus: Record<string, number> = {};
  let spendFail = 0;
  let spendLearning = 0;
  let totalSpend = 0;

  for (const row of learningRows) {
    const sub = mapSubstatusPt(row);
    byStatus[sub] = (byStatus[sub] ?? 0) + 1;
    const spend = spendByAdset.get(row.adset_id) ?? 0;
    totalSpend += spend;
    if (row.learning_status === "learning_fail") spendFail += spend;
    if (row.learning_status === "learning") spendLearning += spend;
  }

  const spendNonOpt = spendFail + spendLearning;
  const pct = totalSpend > 0 ? Math.round((spendNonOpt / totalSpend) * 1000) / 10 : 0;
  const dailyBlind = Math.round(spendNonOpt / 30);

  const failCount = byStatus.budget_limited_learning_fail ?? 0;
  const failAlt = (byStatus.ad_set_learning_exit_unsuccessfully ?? 0) +
    (byStatus.audience_limited_learning ?? 0);
  const failTotal = failCount + failAlt;

  const summaryPt =
    failTotal > 0 && pct >= 20
      ? `${failTotal} conjunto(s) de anúncios estão no modo menos eficiente possível — o Meta recebe verba mas não consegue aprender quem compra. Cerca de ${pct}% do investimento (${formatBrl(spendNonOpt)}/mês) e ~${formatBrl(dailyBlind)}/dia gastos sem otimização plena.`
      : pct > 0
        ? `${pct}% do budget em fase de aprendizado ou com limitações — monitorar antes de escalar.`
        : "Maioria dos conjuntos fora de learning fail — entrega em modo otimizado no recorte.";

  return {
    totalAdsets: learningRows.length,
    byStatus,
    pctSpendNonOptimized: pct,
    spendNonOptimizedFormatted: formatBrl(spendNonOpt),
    estimatedDailyBlindSpendBrl: dailyBlind,
    estimatedDailyBlindSpendFormatted: formatBrl(dailyBlind),
    summaryPt,
  };
}

function formatBrl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function enrichLearningWithSubstatus(
  rows: AdsetLearningStatus[],
): (AdsetLearningStatus & { delivery_substatus_pt: string })[] {
  return rows.map((r) => ({
    ...r,
    delivery_substatus_pt: mapSubstatusPt(r),
  }));
}
