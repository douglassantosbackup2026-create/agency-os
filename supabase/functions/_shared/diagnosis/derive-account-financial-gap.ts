import { computeRoas, num } from "./campaign-objective.ts";
import { deriveAccountEconomics } from "./derive-commercial.ts";
import { resolveRoasTarget } from "./derive-roas-target.ts";
import type { BusinessContextInput } from "./derive-business-hints.ts";
import type { NicheContext } from "./derive-niche-context.ts";

export type AccountFinancialGap = {
  periodLabel: string;
  invested30d: number;
  investedFormatted: string;
  revenueActual: number | null;
  revenueActualFormatted: string;
  roasActual: number | null;
  roasActualFormatted: string;
  roasReferenceNiche: number;
  roasReferenceFormatted: string;
  roasReferenceLabel: string;
  revenuePotential: number | null;
  revenuePotentialFormatted: string;
  gapMonthlyBrl: number;
  gapMonthlyFormatted: string;
  gapAnnualBrl: number;
  gapAnnualFormatted: string;
  nicheLabel: string;
  headlinePt: string;
};

function fmtBrl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function deriveAccountFinancialGap(
  facts: Record<string, unknown> | null | undefined,
  niche: NicheContext,
  businessContext?: BusinessContextInput | null,
): AccountFinancialGap | null {
  const economics = deriveAccountEconomics(facts);
  const invested = economics.spend30d;
  if (invested <= 0) return null;

  const ctx =
    businessContext ??
    (facts?.business_context as BusinessContextInput | undefined);
  const roasResolved = resolveRoasTarget(ctx, niche.nicheKey);
  const roasRef = roasResolved.target;
  const roasActual = economics.roasSales;
  const revenueActual = economics.revenue30d;
  const revenuePotential = roasActual != null ? invested * roasRef : null;

  let gapMonthly = 0;
  if (revenuePotential != null && revenueActual != null && revenuePotential > revenueActual) {
    gapMonthly = Math.round(revenuePotential - revenueActual);
  } else if (roasActual != null && roasActual < roasRef) {
    gapMonthly = Math.round(invested * (roasRef - roasActual));
  }

  const gapAnnual = gapMonthly * 12;
  const revAct = revenueActual ?? 0;
  const revPot = revenuePotential ?? invested * roasRef;

  const headlinePt =
    gapMonthly > 0
      ? `Este mês, sua conta gerou ${fmtBrl(revAct)} com ${fmtBrl(invested)} investidos. Com a meta de ROAS (${roasRef.toFixed(1)}× — ${roasResolved.label}), você poderia ter gerado ${fmtBrl(revPot)}. Diferença: ${fmtBrl(gapMonthly)} que ficaram na mesa.`
      : roasActual != null && roasActual >= roasRef
        ? `ROAS de Vendas (${roasActual.toFixed(2)}×) está na faixa saudável para ${niche.nicheLabel} — foco em escalar o que já performa.`
        : `Investimento de ${fmtBrl(invested)} no período — ajuste benchmarks conforme tracking de vendas.`;

  return {
    periodLabel: "Últimos 30 dias",
    invested30d: invested,
    investedFormatted: economics.spendFormatted,
    revenueActual,
    revenueActualFormatted: economics.revenueFormatted,
    roasActual,
    roasActualFormatted: economics.roasFormatted,
    roasReferenceNiche: roasRef,
    roasReferenceFormatted: `${roasRef.toFixed(1)}×`,
    roasReferenceLabel: roasResolved.label,
    revenuePotential,
    revenuePotentialFormatted: revenuePotential != null ? fmtBrl(revenuePotential) : "—",
    gapMonthlyBrl: gapMonthly,
    gapMonthlyFormatted: fmtBrl(gapMonthly),
    gapAnnualBrl: gapAnnual,
    gapAnnualFormatted: fmtBrl(gapAnnual),
    nicheLabel: niche.nicheLabel,
    headlinePt,
  };
}
