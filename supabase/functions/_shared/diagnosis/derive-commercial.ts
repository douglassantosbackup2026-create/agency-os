/**
 * Camada comercial determinística — perda/recuperação em R$, benchmarks, narrativa executiva.
 * Números derivados apenas de facts_json + campaigns_enriched (sem IA).
 */

import {
  type CampaignEnriched,
  type DerivedStatus,
  computeRoas,
  enrichCampaigns,
  num,
} from "./campaign-objective.ts";
import { deriveFinancialBalance, type FinancialBalance } from "./derive-financial-balance.ts";
import { deriveTopFindings, type TopFinding } from "./derive-top-findings.ts";

export type NicheBenchmarkKey =
  | "ecom_geral"
  | "ecom_moda"
  | "infoproduto"
  | "servico_local"
  | "b2b";

type BenchmarkRange = [number, number];

const NICHE_BENCHMARKS: Record<
  NicheBenchmarkKey,
  { label: string; ranges: Partial<Record<"roas" | "ctr" | "cpm" | "frequencia", BenchmarkRange>> }
> = {
  ecom_geral: {
    label: "E-commerce geral (referência BR)",
    ranges: { roas: [2.5, 5.0], ctr: [1.0, 2.0], cpm: [18, 40], frequencia: [1.5, 3.0] },
  },
  ecom_moda: {
    label: "E-commerce de moda",
    ranges: { roas: [2.0, 4.0], ctr: [1.2, 2.2], cpm: [15, 35], frequencia: [1.5, 3.0] },
  },
  infoproduto: {
    label: "Infoproduto / curso",
    ranges: { roas: [2.0, 4.0], ctr: [1.5, 3.0], cpm: [12, 28], frequencia: [1.5, 2.8] },
  },
  servico_local: {
    label: "Serviço local",
    ranges: { roas: [3.0, 6.0], ctr: [1.0, 2.0], cpm: [10, 25], frequencia: [1.5, 3.0] },
  },
  b2b: {
    label: "B2B / lead gen",
    ranges: { ctr: [0.8, 1.8], cpm: [20, 50], frequencia: [1.5, 3.0] },
  },
};

function fmtBRL(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtBRLPrecise(n: number): string {
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function getEnriched(facts: Record<string, unknown> | null | undefined): CampaignEnriched[] {
  if (!facts) return [];
  if (Array.isArray(facts.campaigns_enriched)) {
    return facts.campaigns_enriched as CampaignEnriched[];
  }
  const sample = Array.isArray(facts.campaigns_sample)
    ? (facts.campaigns_sample as Record<string, unknown>[])
    : [];
  const insights = Array.isArray(facts.campaigns_insights)
    ? (facts.campaigns_insights as Record<string, unknown>[])
    : [];
  return enrichCampaigns(sample, insights);
}

export function matchNicheFromContext(niche: string | null | undefined): NicheBenchmarkKey {
  if (!niche) return "ecom_geral";
  const t = niche.toLowerCase();
  if (/(moda|roupa|vestu|calçad|sapato)/.test(t)) return "ecom_moda";
  if (/(info\s*produto|curso|mentoria|ebook)/.test(t)) return "infoproduto";
  if (/(b2b|lead|saas|software|consultoria)/.test(t)) return "b2b";
  if (/(local|cl[ií]nica|barbearia|sal[aã]o|odonto)/.test(t)) return "servico_local";
  return "ecom_geral";
}

export type AccountEconomics = {
  spend30d: number;
  revenue30d: number | null;
  roasSales: number | null;
  mediaProfit: number | null;
  spendFormatted: string;
  revenueFormatted: string;
  roasFormatted: string;
  mediaProfitFormatted: string;
};

export function deriveAccountEconomics(
  facts: Record<string, unknown> | null | undefined,
): AccountEconomics {
  const enriched = getEnriched(facts);
  const sales = enriched.filter((c) => c.family === "sales");
  let spend = 0;
  let revenue = 0;
  let hasRev = false;
  for (const c of sales) {
    spend += c.spend;
    if (c.roas != null && c.spend > 0) {
      revenue += c.roas * c.spend;
      hasRev = true;
    }
  }
  if (spend === 0) {
    spend = enriched.reduce((s, c) => s + c.spend, 0);
  }
  const roasSales = spend > 0 && hasRev ? revenue / spend : null;
  const mediaProfit = hasRev ? revenue - spend : null;
  return {
    spend30d: spend,
    revenue30d: hasRev ? revenue : null,
    roasSales,
    mediaProfit,
    spendFormatted: fmtBRL(spend),
    revenueFormatted: hasRev ? fmtBRL(revenue) : "—",
    roasFormatted: roasSales != null ? `${roasSales.toFixed(2).replace(".", ",")}x` : "—",
    mediaProfitFormatted:
      mediaProfit != null ? fmtBRLPrecise(mediaProfit) : "—",
  };
}

/** Peso de gasto considerado “em risco” — vendas pesam mais; awareness/tráfego não por ROAS. */
export function campaignWasteFraction(c: CampaignEnriched): number {
  if (c.family === "sales") {
    if (c.kpi_status === "sem tracking") return 1;
    if (c.kpi_status === "alerta") {
      if (c.roas != null && c.roas < 1) return 1;
      return 0.55;
    }
    if (c.kpi_status === "atenção") return 0.3;
    return 0;
  }
  if (c.kpi_status === "alerta") return 0.12;
  if (c.kpi_status === "atenção") return 0.05;
  return 0;
}

export type WasteLine = {
  label: string;
  monthlyBrl: number;
  campaignNames: string[];
};

export type WasteBreakdown = {
  totalMonthlyBrl: number;
  totalFormatted: string;
  lines: WasteLine[];
  salesUntrackedSpend: number;
  paretoAds: {
    topSpendSharePct: number;
    adsWithResultsPct: number;
    note: string;
  } | null;
};

export function deriveWasteBreakdown(
  facts: Record<string, unknown> | null | undefined,
): WasteBreakdown {
  const enriched = getEnriched(facts);
  const lines: WasteLine[] = [];

  const salesAlert = enriched.filter(
    (c) => c.family === "sales" && (c.kpi_status === "alerta" || c.kpi_status === "atenção"),
  );
  if (salesAlert.length) {
    const monthlyBrl = salesAlert.reduce((s, c) => s + c.spend * campaignWasteFraction(c), 0);
    lines.push({
      label: "Campanhas de Vendas com eficiência abaixo do ideal",
      monthlyBrl,
      campaignNames: salesAlert.map((c) => c.name).slice(0, 5),
    });
  }

  const salesNoTrack = enriched.filter(
    (c) => c.family === "sales" && c.kpi_status === "sem tracking",
  );
  const salesUntrackedSpend = salesNoTrack.reduce((s, c) => s + c.spend, 0);
  if (salesUntrackedSpend > 0) {
    lines.push({
      label: "Investimento em Vendas sem compras rastreadas (cegueira de resultado)",
      monthlyBrl: salesUntrackedSpend,
      campaignNames: salesNoTrack.map((c) => c.name).slice(0, 5),
    });
  }

  const otherAlert = enriched.filter(
    (c) => c.family !== "sales" && c.kpi_status === "alerta",
  );
  if (otherAlert.length) {
    const monthlyBrl = otherAlert.reduce((s, c) => s + c.spend * campaignWasteFraction(c), 0);
    if (monthlyBrl > 0) {
      lines.push({
        label: "Campanhas de topo/meio de funil com sinais de saturação ou custo alto",
        monthlyBrl,
        campaignNames: otherAlert.map((c) => c.name).slice(0, 5),
      });
    }
  }

  const totalMonthlyBrl = lines.reduce((s, l) => s + l.monthlyBrl, 0);

  let paretoAds: WasteBreakdown["paretoAds"] = null;
  const ads = Array.isArray(facts?.ads_insights_top)
    ? (facts!.ads_insights_top as Record<string, unknown>[])
    : [];
  if (ads.length >= 3) {
    const sorted = [...ads].sort((a, b) => (num(b.spend) ?? 0) - (num(a.spend) ?? 0));
    const totalAdSpend = sorted.reduce((s, a) => s + (num(a.spend) ?? 0), 0);
    if (totalAdSpend > 0) {
      const topN = Math.max(1, Math.ceil(sorted.length * 0.2));
      const topSpend = sorted.slice(0, topN).reduce((s, a) => s + (num(a.spend) ?? 0), 0);
      const withPurchase = sorted.filter((a) => {
        const spend = num(a.spend) ?? 0;
        const roas = computeRoas(a.action_values, spend);
        return roas != null && roas > 0;
      }).length;
      paretoAds = {
        topSpendSharePct: Math.round((topSpend / totalAdSpend) * 1000) / 10,
        adsWithResultsPct: Math.round((withPurchase / sorted.length) * 1000) / 10,
        note:
          withPurchase / sorted.length < 0.35
            ? `Apenas ${withPurchase} de ${sorted.length} anúncios com maior gasto mostram compra rastreada — concentração de risco.`
            : `${topN} anúncios concentram ${Math.round((topSpend / totalAdSpend) * 100)}% do gasto analisado.`,
      };
    }
  }

  return {
    totalMonthlyBrl,
    totalFormatted: fmtBRL(totalMonthlyBrl),
    lines,
    salesUntrackedSpend,
    paretoAds,
  };
}

export type RecoveryScenarios = {
  conservativeMonthlyBrl: number;
  optimisticMonthlyBrl: number;
  conservativeFormatted: string;
  optimisticFormatted: string;
  confidence: "low" | "medium";
  basisNote: string;
};

export function deriveRecoveryScenarios(
  waste: WasteBreakdown,
  economics: AccountEconomics,
  facts: Record<string, unknown> | null | undefined,
): RecoveryScenarios {
  const enriched = getEnriched(facts);
  const goodSales = enriched.filter((c) => c.family === "sales" && c.kpi_status === "bom" && c.roas != null);
  let avgRoas =
    goodSales.length > 0
      ? goodSales.reduce((s, c) => s + (c.roas ?? 0), 0) / goodSales.length
      : economics.roasSales ?? 2.5;

  const wasteSpend = waste.totalMonthlyBrl;
  const conservativeMonthlyBrl = wasteSpend * 0.15 * avgRoas;
  const optimisticMonthlyBrl = wasteSpend * 0.3 * avgRoas;
  const confidence: "low" | "medium" =
    wasteSpend > 0 && (economics.roasSales != null || goodSales.length > 0) ? "medium" : "low";

  return {
    conservativeMonthlyBrl,
    optimisticMonthlyBrl,
    conservativeFormatted: fmtBRL(conservativeMonthlyBrl),
    optimisticFormatted: fmtBRL(optimisticMonthlyBrl),
    confidence,
    basisNote:
      `Estimativa indicativa: recuperar 15–30% do gasto em risco (≈ ${fmtBRL(wasteSpend)}) com eficiência próxima ao ROAS ${avgRoas.toFixed(1)}x das campanhas bem classificadas.`,
  };
}

export type BenchmarkGap = {
  metric: string;
  current: string;
  reference: string;
  status: "above" | "within" | "below" | "na";
  gapNote: string;
  deltaLabel: string;
  deltaPct: number | null;
  isBad: boolean;
};

function gapDelta(
  current: number,
  lo: number,
  hi: number,
  higherIsBetter: boolean,
): { deltaLabel: string; deltaPct: number | null; isBad: boolean } {
  const mid = (lo + hi) / 2;
  if (!Number.isFinite(current) || mid === 0) {
    return { deltaLabel: "—", deltaPct: null, isBad: false };
  }
  const pct = Math.round(((current - mid) / mid) * 100);
  const arrow = pct >= 0 ? "↑" : "↓";
  const isBad = higherIsBetter ? current < lo : current > hi;
  return {
    deltaLabel: `${arrow}${Math.abs(pct)}%`,
    deltaPct: Math.abs(pct),
    isBad,
  };
}

export type BenchmarkComparison = {
  nicheKey: NicheBenchmarkKey;
  nicheLabel: string;
  gaps: BenchmarkGap[];
};

export function deriveBenchmarkGaps(
  facts: Record<string, unknown> | null | undefined,
  nicheKey: NicheBenchmarkKey = "ecom_geral",
): BenchmarkComparison {
  const bench = NICHE_BENCHMARKS[nicheKey];
  const economics = deriveAccountEconomics(facts);
  const ins = (facts?.account_insights ?? {}) as Record<string, unknown>;
  const ctr = num(ins.ctr);
  const cpm = num(ins.cpm);
  const frequency = num(ins.frequency);
  const gaps: BenchmarkGap[] = [];

  const roasRange = bench.ranges.roas;
  if (roasRange && economics.roasSales != null) {
    const [lo, hi] = roasRange;
    const status =
      economics.roasSales >= hi ? "above" : economics.roasSales >= lo ? "within" : "below";
    const delta = gapDelta(economics.roasSales, lo, hi, true);
    gaps.push({
      metric: "ROAS (Vendas)",
      current: economics.roasFormatted,
      reference: `${lo.toFixed(1)}–${hi.toFixed(1)}x`,
      status,
      gapNote:
        status === "below"
          ? `Abaixo da faixa típica do nicho — há espaço para ganho de eficiência.`
          : status === "above"
            ? `Acima da média observada em contas similares.`
            : `Dentro da faixa de referência do nicho.`,
      ...delta,
    });
  }

  const ctrRange = bench.ranges.ctr;
  if (ctrRange && ctr != null) {
    const [lo, hi] = ctrRange;
    const status = ctr >= hi ? "above" : ctr >= lo ? "within" : "below";
    const delta = gapDelta(ctr, lo, hi, true);
    gaps.push({
      metric: "CTR (conta)",
      current: `${ctr.toFixed(2).replace(".", ",")}%`,
      reference: `${lo.toFixed(1)}–${hi.toFixed(1)}%`,
      status,
      gapNote:
        status === "below"
          ? `CTR abaixo do típico — criativos ou segmentação podem estar limitando cliques.`
          : `CTR na faixa esperada para o nicho.`,
      ...delta,
    });
  }

  const cpmRange = bench.ranges.cpm;
  if (cpmRange && cpm != null) {
    const [lo, hi] = cpmRange;
    const status = cpm <= lo ? "above" : cpm <= hi ? "within" : "below";
    const delta = gapDelta(cpm, lo, hi, false);
    gaps.push({
      metric: "CPM (conta)",
      current: fmtBRLPrecise(cpm),
      reference: `R$ ${lo}–${hi}`,
      status,
      gapNote:
        status === "below"
          ? `CPM acima da faixa — leilão ou público pode estar caro.`
          : `CPM competitivo para o nicho.`,
      ...delta,
    });
  }

  const freqRange = bench.ranges.frequencia;
  if (freqRange && frequency != null) {
    const [lo, hi] = freqRange;
    const status = frequency <= hi ? "within" : "below";
    const delta = gapDelta(frequency, lo, hi, false);
    gaps.push({
      metric: "Frequência (30d)",
      current: frequency.toFixed(1).replace(".", ","),
      reference: `${lo.toFixed(1)}–${hi.toFixed(1)}`,
      status,
      gapNote:
        status === "below"
          ? `Frequência alta — risco de saturação de público.`
          : `Frequência controlada.`,
      ...delta,
    });
  }

  return { nicheKey, nicheLabel: bench.label, gaps };
}

export type ScorePillar = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

export type ScoreExplanation = {
  formulaNote: string;
  pillars: ScorePillar[];
};

export function deriveScoreExplanation(
  facts: Record<string, unknown> | null | undefined,
): ScoreExplanation {
  const enriched = getEnriched(facts);
  const totalSpend = enriched.reduce((s, c) => s + c.spend, 0);
  const alertSpend = enriched
    .filter((c) => c.kpi_status === "alerta")
    .reduce((s, c) => s + c.spend, 0);
  const warnSpend = enriched
    .filter((c) => c.kpi_status === "atenção")
    .reduce((s, c) => s + c.spend, 0);
  const noTrackSpend = enriched
    .filter((c) => c.kpi_status === "sem tracking")
    .reduce((s, c) => s + c.spend, 0);
  const pct = (part: number) =>
    totalSpend > 0 ? `${Math.round((part / totalSpend) * 1000) / 10}%` : "—";

  const families = new Set(enriched.map((c) => c.family));
  const mixed = families.size > 1;

  const ins = (facts?.account_insights ?? {}) as Record<string, unknown>;
  const frequency = num(ins.frequency);

  const pillars: ScorePillar[] = [
    {
      id: "efficiency",
      label: "Eficiência por campanha",
      value: pct(alertSpend + warnSpend),
      detail:
        "Percentual do gasto em campanhas classificadas como atenção ou alerta (KPI do objetivo de cada campanha).",
    },
    {
      id: "tracking",
      label: "Rastreamento de vendas",
      value: pct(noTrackSpend),
      detail: "Gasto em campanhas de Vendas sem compras atribuídas no período.",
    },
    {
      id: "funnel",
      label: "Mix de funil",
      value: mixed ? "Misto" : "Focado",
      detail: mixed
        ? "Várias famílias de objetivo — ROAS de compra só vale para Vendas."
        : "Conta concentrada em um tipo de objetivo.",
    },
  ];

  if (frequency != null) {
    pillars.push({
      id: "frequency",
      label: "Frequência (conta)",
      value: frequency.toFixed(1).replace(".", ","),
      detail: "Média 30d — acima de 5 indica saturação.",
    });
  }

  return {
    formulaNote:
      "Score 0–100: média ponderada pelo gasto de cada campanha (bom=100, atenção=72, alerta=45, sem tracking=55). Quanto maior o gasto em campanhas problemáticas, menor o score.",
    pillars,
  };
}

export type StoryExecutive = {
  headline: string;
  lossMonthlyBrl: number;
  lossMonthlyFormatted: string;
  recoveryConservativeBrl: number;
  recoveryOptimisticBrl: number;
  recoveryRangeFormatted: string;
  problemCount: number;
  quickWinCount: number;
};

export function deriveStoryExecutive(
  waste: WasteBreakdown,
  recovery: RecoveryScenarios,
  economics: AccountEconomics,
  facts: Record<string, unknown> | null | undefined,
): StoryExecutive {
  const enriched = getEnriched(facts);
  const problemCount =
    enriched.filter((c) => c.kpi_status === "alerta" || c.kpi_status === "sem tracking").length +
    waste.lines.length;
  const quickWinCount = enriched.filter(
    (c) => c.kpi_status === "atenção" || (c.family === "sales" && c.kpi_status === "sem tracking"),
  ).length;

  let headline: string;
  if (waste.totalMonthlyBrl >= 3000) {
    headline = `Estimamos até ${waste.totalFormatted}/mês em verba Meta em risco ou sem visibilidade de venda.`;
  } else if (waste.totalMonthlyBrl > 0) {
    headline = `Há cerca de ${waste.totalFormatted}/mês em eficiência a recuperar na sua conta Meta.`;
  } else if (economics.roasSales != null && economics.roasSales < 2) {
    headline = `ROAS de Vendas em ${economics.roasFormatted} — abaixo do que sustenta escala com margem típica.`;
  } else {
    headline = `Conta com base analisável — foco em consolidar o que já performa e corrigir pontos de atenção.`;
  }

  return {
    headline,
    lossMonthlyBrl: waste.totalMonthlyBrl,
    lossMonthlyFormatted: waste.totalFormatted,
    recoveryConservativeBrl: recovery.conservativeMonthlyBrl,
    recoveryOptimisticBrl: recovery.optimisticMonthlyBrl,
    recoveryRangeFormatted: `${recovery.conservativeFormatted} – ${recovery.optimisticFormatted}`,
    problemCount,
    quickWinCount,
  };
}

export type CommercialDerived = {
  accountEconomics: AccountEconomics;
  waste: WasteBreakdown;
  recovery: RecoveryScenarios;
  benchmarkComparison: BenchmarkComparison;
  scoreExplanation: ScoreExplanation;
  storyExecutive: StoryExecutive;
  topFindings: TopFinding[];
  financialBalance: FinancialBalance;
};

export function buildCommercialDerived(
  facts: Record<string, unknown> | null | undefined,
): CommercialDerived {
  const ctx = facts?.business_context as { niche?: string } | undefined;
  const nicheKey = matchNicheFromContext(ctx?.niche ?? null);
  const economics = deriveAccountEconomics(facts);
  const waste = deriveWasteBreakdown(facts);
  const recovery = deriveRecoveryScenarios(waste, economics, facts);
  const benchmarkComparison = deriveBenchmarkGaps(facts, nicheKey);
  const scoreExplanation = deriveScoreExplanation(facts);
  const storyExecutive = deriveStoryExecutive(waste, recovery, economics, facts);
  const topFindings = deriveTopFindings(facts, waste, benchmarkComparison);
  const financialBalance = deriveFinancialBalance(economics, waste, recovery);
  return {
    accountEconomics: economics,
    waste,
    recovery,
    benchmarkComparison,
    scoreExplanation,
    storyExecutive,
    topFindings,
    financialBalance,
  };
}

/** Campos para analysis_json (UI + prompt). */
export function commercialToAnalysisFields(
  commercial: CommercialDerived,
): Record<string, unknown> {
  return {
    financialImpact: {
      spend30d: commercial.accountEconomics.spend30d,
      revenue30d: commercial.accountEconomics.revenue30d,
      roasSales: commercial.accountEconomics.roasSales,
      mediaProfit: commercial.accountEconomics.mediaProfit,
      spendFormatted: commercial.accountEconomics.spendFormatted,
      revenueFormatted: commercial.accountEconomics.revenueFormatted,
      roasFormatted: commercial.accountEconomics.roasFormatted,
      mediaProfitFormatted: commercial.accountEconomics.mediaProfitFormatted,
      lossMonthlyBrl: commercial.storyExecutive.lossMonthlyBrl,
      lossMonthlyFormatted: commercial.storyExecutive.lossMonthlyFormatted,
      wasteLines: commercial.waste.lines,
      paretoAds: commercial.waste.paretoAds,
      recoveryConservativeBrl: commercial.recovery.conservativeMonthlyBrl,
      recoveryOptimisticBrl: commercial.recovery.optimisticMonthlyBrl,
      recoveryConservativeFormatted: commercial.recovery.conservativeFormatted,
      recoveryOptimisticFormatted: commercial.recovery.optimisticFormatted,
      recoveryConfidence: commercial.recovery.confidence,
      recoveryBasisNote: commercial.recovery.basisNote,
    },
    scoreExplanation: commercial.scoreExplanation,
    storyExecutive: commercial.storyExecutive,
    benchmarkComparison: commercial.benchmarkComparison,
    topFindings: commercial.topFindings,
    financialBalance: commercial.financialBalance,
  };
}

export type { TopFinding } from "./derive-top-findings.ts";
export type { FinancialBalance } from "./derive-financial-balance.ts";
