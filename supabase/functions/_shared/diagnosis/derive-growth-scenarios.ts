import type { CommercialDerived } from "./derive-commercial.ts";
import type { GrowthScenarios } from "./derive-senior-types.ts";

function fmtPct(n: number): string {
  return `+${n.toFixed(0)}%`;
}

export function deriveGrowthScenarios(commercial: CommercialDerived): GrowthScenarios {
  const recovery = commercial.recovery.conservativeMonthlyBrl;
  const waste = commercial.waste.totalMonthlyBrl;
  const revenue = commercial.accountEconomics.revenue30d;
  const spend = commercial.accountEconomics.spend30d;

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

  let basisNote =
    "Cenários indicativos com base em recuperação de desperdício e headroom de escala — não são garantia de resultado.";
  if (revenue != null && revenue > 0) {
    basisNote += ` Receita rastreada no período: referência para upside relativo.`;
  }

  return {
    conservativePct,
    probablePct,
    aggressivePct,
    conservativeFormatted: fmtPct(conservativePct),
    probableFormatted: fmtPct(probablePct),
    aggressiveFormatted: fmtPct(aggressivePct),
    basisNote,
    confidence: recovery > 300 ? "medium" : "low",
  };
}
