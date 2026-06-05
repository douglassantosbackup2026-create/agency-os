import type { CommercialDerived } from "./derive-commercial.ts";
import type { GrowthScenarios } from "./derive-senior-types.ts";

function fmtBrl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number): string {
  return `+${n.toFixed(0)}%`;
}

function fmtUplift(monthlyBrl: number, pct: number): string {
  if (monthlyBrl <= 0) return fmtPct(pct);
  return `+${fmtBrl(monthlyBrl)}/mês (${fmtPct(pct)})`;
}

export function deriveGrowthScenarios(commercial: CommercialDerived): GrowthScenarios {
  const recovery = commercial.recovery.conservativeMonthlyBrl;
  const waste = commercial.waste.totalMonthlyBrl;
  const revenue = commercial.accountEconomics.revenue30d;
  const spend = commercial.accountEconomics.spend30d;
  const roas = commercial.accountEconomics.roasSales;

  let basePct = 12;
  if (recovery > 0 && spend > 0) {
    const recoveryPct = (recovery / spend) * 100;
    basePct = Math.min(28, Math.max(8, recoveryPct * 0.45));
  }
  if (waste > recovery * 2 && waste > 500) {
    basePct = Math.min(basePct + 4, 32);
  }

  const conservativePct = Math.round(basePct * 0.55);
  const probablePct = Math.round(basePct);
  const aggressivePct = Math.round(basePct * 1.65);

  const upliftBrl = (pct: number): number => {
    if (revenue != null && revenue > 0) {
      return Math.round(revenue * (pct / 100));
    }
    if (spend > 0 && roas != null && roas > 0) {
      return Math.round(spend * roas * (pct / 100));
    }
    if (spend > 0) {
      return Math.round(spend * (pct / 100));
    }
    return 0;
  };

  const conservativeMonthlyBrl = upliftBrl(conservativePct);
  const probableMonthlyBrl = upliftBrl(probablePct);
  const aggressiveMonthlyBrl = upliftBrl(aggressivePct);

  let basisNote =
    "Cenários indicativos com base em recuperação de desperdício e headroom de escala — não são garantia de resultado.";
  if (revenue != null && revenue > 0) {
    basisNote += ` Receita rastreada no período: referência para upside relativo.`;
  }

  const revenueFormatted =
    revenue != null && revenue > 0
      ? fmtBrl(revenue)
      : null;

  return {
    conservativePct,
    probablePct,
    aggressivePct,
    conservativeMonthlyBrl,
    probableMonthlyBrl,
    aggressiveMonthlyBrl,
    conservativeFormatted: fmtUplift(conservativeMonthlyBrl, conservativePct),
    probableFormatted: fmtUplift(probableMonthlyBrl, probablePct),
    aggressiveFormatted: fmtUplift(aggressiveMonthlyBrl, aggressivePct),
    basisNote,
    confidence: recovery > 300 ? "medium" : "low",
    revenueFormatted,
  };
}
