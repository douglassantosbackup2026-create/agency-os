/**
 * Balanço financeiro 30d — capítulo único para UI v10 (sem barras de magnitudes diferentes).
 */

import type {
  AccountEconomics,
  RecoveryScenarios,
  WasteBreakdown,
} from "./derive-commercial.ts";

function fmtBRL(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

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

export function deriveFinancialBalance(
  economics: AccountEconomics,
  waste: WasteBreakdown,
  recovery: RecoveryScenarios,
): FinancialBalance {
  const invested30d = economics.spend30d;
  const atRisk30d = waste.totalMonthlyBrl;
  const recoverableConservative = recovery.conservativeMonthlyBrl;
  const recoverableOptimistic = recovery.optimisticMonthlyBrl;

  let netPositionLabel: string;
  if (economics.roasSales != null && atRisk30d > 0) {
    netPositionLabel = `ROAS Vendas ${economics.roasFormatted} com ${fmtBRL(atRisk30d)} em risco no período.`;
  } else if (economics.roasSales != null) {
    netPositionLabel = `ROAS Vendas ${economics.roasFormatted} — sem verba crítica estimada no mix atual.`;
  } else if (atRisk30d > 0) {
    netPositionLabel = `${fmtBRL(atRisk30d)} em gasto sem visibilidade de venda ou com KPI em alerta.`;
  } else {
    netPositionLabel = "Conta com indicadores estáveis no recorte analisado — foco em escalar o que performa.";
  }

  const allocationNote =
    invested30d > 0
      ? `Do investimento de ${fmtBRL(invested30d)}: lucro de mídia estimado ${economics.mediaProfitFormatted}, ${fmtBRL(atRisk30d)} em risco, recuperação indicativa ${recovery.conservativeFormatted}–${recovery.optimisticFormatted}.`
      : "Dados de investimento insuficientes no período.";

  return {
    invested30d,
    investedFormatted: economics.spendFormatted,
    revenue30d: economics.revenue30d,
    revenueFormatted: economics.revenueFormatted,
    mediaProfit30d: economics.mediaProfit,
    mediaProfitFormatted: economics.mediaProfitFormatted,
    atRisk30d,
    atRiskFormatted: waste.totalFormatted,
    recoverableConservative,
    recoverableOptimistic,
    recoverableConservativeFormatted: recovery.conservativeFormatted,
    recoverableOptimisticFormatted: recovery.optimisticFormatted,
    netPositionLabel,
    allocationNote,
  };
}
