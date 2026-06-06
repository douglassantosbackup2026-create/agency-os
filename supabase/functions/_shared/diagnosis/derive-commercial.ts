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
import { buildSeniorDerived, type SeniorDerived } from "./derive-senior.ts";
import type { AccountFinancialGap } from "./derive-account-financial-gap.ts";
import {
  classifyTier,
  formatTierGapNote,
  NICHE_BENCHMARKS_V1,
  type BenchmarkTier,
} from "./niche-benchmarks-v1.ts";
import { normalizeCtrPct, resolveRoasTarget } from "./derive-roas-target.ts";
import type { BusinessContextInput } from "./derive-business-hints.ts";

export type NicheBenchmarkKey =
  | "ecom_geral"
  | "ecom_moda"
  | "ecom_beleza"
  | "ecom_casa"
  | "ecom_eletronicos"
  | "ecom_esportes"
  | "ecom_alimentos"
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
  if (/(moda|roupa|vestu|calçad|sapato|acess[oó]rio|tricot|paprika|páprika)/.test(t)) {
    return "ecom_moda";
  }
  if (/(beleza|cosm[eé]tic|skincare|maquiagem)/.test(t)) return "ecom_beleza";
  if (/(casa|decora|móvel|mobili)/.test(t)) return "ecom_casa";
  if (/(eletr[oô]nic|tech|celular|gadget)/.test(t)) return "ecom_eletronicos";
  if (/(esporte|fitness|suplemento|academia)/.test(t)) return "ecom_esportes";
  if (/(aliment|bebida|comida|nutri)/.test(t)) return "ecom_alimentos";
  if (/(info\s*produto|curso|mentoria|ebook)/.test(t)) return "infoproduto";
  if (/(b2b|lead|saas|software|consultoria)/.test(t)) return "b2b";
  if (/(local|cl[ií]nica|barbearia|sal[aã]o|odonto)/.test(t)) return "servico_local";
  if (/(loja|ecom|e-?commerce|shop|marketplace)/.test(t)) return "ecom_geral";
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
  gapMonthlyBrl = 0,
): RecoveryScenarios {
  const enriched = getEnriched(facts);
  const goodSales = enriched.filter((c) => c.family === "sales" && c.kpi_status === "bom" && c.roas != null);
  let avgRoas =
    goodSales.length > 0
      ? goodSales.reduce((s, c) => s + (c.roas ?? 0), 0) / goodSales.length
      : economics.roasSales ?? 2.5;

  const wasteSpend = waste.totalMonthlyBrl;
  const baseMonthly = Math.max(wasteSpend, gapMonthlyBrl);

  let conservativeMonthlyBrl: number;
  let optimisticMonthlyBrl: number;

  if (baseMonthly > 0 && gapMonthlyBrl > wasteSpend) {
    conservativeMonthlyBrl = Math.round(gapMonthlyBrl * 0.35);
    optimisticMonthlyBrl = gapMonthlyBrl;
  } else if (wasteSpend > 0) {
    conservativeMonthlyBrl = wasteSpend * 0.15 * avgRoas;
    optimisticMonthlyBrl = wasteSpend * 0.3 * avgRoas;
  } else if (gapMonthlyBrl > 0) {
    conservativeMonthlyBrl = Math.round(gapMonthlyBrl * 0.35);
    optimisticMonthlyBrl = gapMonthlyBrl;
  } else {
    conservativeMonthlyBrl = 0;
    optimisticMonthlyBrl = 0;
  }

  const confidence: "low" | "medium" =
    baseMonthly > 0 && (economics.roasSales != null || goodSales.length > 0) ? "medium" : "low";

  return {
    conservativeMonthlyBrl,
    optimisticMonthlyBrl,
    conservativeFormatted: fmtBRL(conservativeMonthlyBrl),
    optimisticFormatted: fmtBRL(optimisticMonthlyBrl),
    confidence,
    basisNote:
      gapMonthlyBrl > wasteSpend
        ? `Estimativa indicativa: recuperar 35–100% do gap vs meta de ROAS (≈ ${fmtBRL(gapMonthlyBrl)}/mês na mesa).`
        : `Estimativa indicativa: recuperar 15–30% do gasto em risco (≈ ${fmtBRL(wasteSpend)}) com eficiência próxima ao ROAS ${avgRoas.toFixed(1)}x das campanhas bem classificadas.`,
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

function tierToStatus(tier: BenchmarkTier): "below" | "within" | "above" {
  if (tier === "ruim") return "below";
  if (tier === "atencao") return "within";
  return "above";
}

function pushTierGap(
  gaps: BenchmarkGap[],
  nicheKey: string,
  metricLabel: string,
  current: number,
  currentFormatted: string,
  metricKey: "roas" | "cpm" | "ctrConversion" | "frequencia",
  formatRef: (n: number) => string,
): void {
  const v1 = NICHE_BENCHMARKS_V1[nicheKey] ?? NICHE_BENCHMARKS_V1.ecom_geral;
  const m = v1[metricKey];
  if (!m) return;
  const tier = classifyTier(current, m);
  const [lo, hi] = m.bom;
  const status = tierToStatus(tier);
  const delta = gapDelta(current, lo, hi, m.higherIsBetter);
  const gapNote =
    formatTierGapNote(metricLabel, current, nicheKey, metricKey, formatRef) ||
    (status === "below"
      ? `${metricLabel} abaixo do mínimo saudável do nicho.`
      : `${metricLabel} na faixa de referência (${tier}).`);
  gaps.push({
    metric: metricLabel,
    current: currentFormatted,
    reference: `${formatRef(lo)}–${formatRef(hi)} (bom)`,
    status,
    gapNote,
    isBad: tier === "ruim" || tier === "atencao",
    ...delta,
  });
}

export function deriveBenchmarkGaps(
  facts: Record<string, unknown> | null | undefined,
  nicheKey: NicheBenchmarkKey = "ecom_geral",
): BenchmarkComparison {
  const v1 = NICHE_BENCHMARKS_V1[nicheKey] ?? NICHE_BENCHMARKS_V1.ecom_geral;
  const economics = deriveAccountEconomics(facts);
  const ins = (facts?.account_insights ?? {}) as Record<string, unknown>;
  const ctx = facts?.business_context as BusinessContextInput | undefined;
  const roasTarget = resolveRoasTarget(ctx, nicheKey);
  const ctr = normalizeCtrPct(num(ins.ctr));
  const cpm = num(ins.cpm);
  const frequency = num(ins.frequency);
  const gaps: BenchmarkGap[] = [];

  if (economics.roasSales != null) {
    const refLabel =
      roasTarget.source === "declared"
        ? `${roasTarget.target.toFixed(1).replace(".", ",")}× (meta declarada)`
        : `${roasTarget.target.toFixed(1).replace(".", ",")}× (${roasTarget.label})`;
    const tier = classifyTier(economics.roasSales, {
      ...v1.roas!,
      bom: [roasTarget.target, roasTarget.target * 1.2],
      atencao: [roasTarget.target * 0.6, roasTarget.target * 0.95],
      ruim: roasTarget.target * 0.6,
      excelente: roasTarget.target * 1.2,
      higherIsBetter: true,
    });
    const status = tierToStatus(tier);
    const delta = gapDelta(
      economics.roasSales,
      roasTarget.target,
      roasTarget.target * 1.2,
      true,
    );
    gaps.push({
      metric: "ROAS (Vendas)",
      current: economics.roasFormatted,
      reference: refLabel,
      status,
      gapNote:
        economics.roasSales < roasTarget.target
          ? `ROAS ${economics.roasFormatted} vs meta ${roasTarget.target.toFixed(1)}× — gap de eficiência.`
          : `ROAS na faixa da meta (${tier}).`,
      ...delta,
    });
  }

  if (v1.ctrConversion && ctr != null) {
    pushTierGap(
      gaps,
      nicheKey,
      "CTR (conta)",
      ctr,
      `${ctr.toFixed(2).replace(".", ",")}%`,
      "ctrConversion",
      (n) => `${n.toFixed(2).replace(".", ",")}%`,
    );
  }

  if (v1.cpm && cpm != null) {
    pushTierGap(
      gaps,
      nicheKey,
      "CPM (conta)",
      cpm,
      fmtBRLPrecise(cpm),
      "cpm",
      (n) => fmtBRLPrecise(n),
    );
  }

  if (v1.frequencia && frequency != null) {
    pushTierGap(
      gaps,
      nicheKey,
      "Frequência (30d)",
      frequency,
      frequency.toFixed(1).replace(".", ","),
      "frequencia",
      (n) => n.toFixed(1).replace(".", ","),
    );
  }

  return { nicheKey, nicheLabel: v1.label, gaps };
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

export type ExecutiveFinancials = {
  primaryGapMonthlyBrl: number;
  primaryGapMonthlyFormatted: string;
  heroRangeFormatted: string;
  heroValueFormatted: string;
};

export function resolveExecutiveFinancials(
  waste: WasteBreakdown,
  recovery: RecoveryScenarios,
  gap: AccountFinancialGap | null,
  leaksMonthlyBrl = 0,
): ExecutiveFinancials {
  const gapMonthly = gap?.gapMonthlyBrl ?? 0;
  const primaryGap = Math.max(waste.totalMonthlyBrl, gapMonthly, leaksMonthlyBrl);
  const conservative =
    recovery.conservativeMonthlyBrl > 0
      ? recovery.conservativeMonthlyBrl
      : Math.round(primaryGap * 0.35);
  const optimistic =
    recovery.optimisticMonthlyBrl > 0 ? recovery.optimisticMonthlyBrl : primaryGap;
  const heroRange =
    primaryGap > 0
      ? `${fmtBRL(conservative)} – ${fmtBRL(optimistic)}`
      : `${recovery.conservativeFormatted} – ${recovery.optimisticFormatted}`;
  return {
    primaryGapMonthlyBrl: primaryGap,
    primaryGapMonthlyFormatted: fmtBRL(primaryGap),
    heroRangeFormatted: heroRange,
    heroValueFormatted: primaryGap > 0 ? heroRange : heroRange,
  };
}

export type StoryExecutive = {
  headline: string;
  lossMonthlyBrl: number;
  lossMonthlyFormatted: string;
  primaryGapMonthlyBrl: number;
  primaryGapMonthlyFormatted: string;
  heroRangeFormatted: string;
  heroValueFormatted: string;
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
  gap: AccountFinancialGap | null = null,
): StoryExecutive {
  const enriched = getEnriched(facts);
  const problemCount =
    enriched.filter((c) => c.kpi_status === "alerta" || c.kpi_status === "sem tracking").length +
    waste.lines.length;
  const quickWinCount = enriched.filter(
    (c) => c.kpi_status === "atenção" || (c.family === "sales" && c.kpi_status === "sem tracking"),
  ).length;

  let headline: string;
  const execFin = resolveExecutiveFinancials(waste, recovery, gap);
  if (execFin.primaryGapMonthlyBrl >= 3000) {
    headline = `Identificamos ${execFin.heroRangeFormatted}/mês em oportunidade não capturada vs sua meta de ROAS.`;
  } else if (execFin.primaryGapMonthlyBrl > 0) {
    headline = `Há cerca de ${execFin.primaryGapMonthlyFormatted}/mês entre o que a conta gera e o potencial com a meta de ROAS.`;
  } else if (waste.totalMonthlyBrl >= 3000) {
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
    lossMonthlyBrl: execFin.primaryGapMonthlyBrl,
    lossMonthlyFormatted: execFin.primaryGapMonthlyFormatted,
    primaryGapMonthlyBrl: execFin.primaryGapMonthlyBrl,
    primaryGapMonthlyFormatted: execFin.primaryGapMonthlyFormatted,
    heroRangeFormatted: execFin.heroRangeFormatted,
    heroValueFormatted: execFin.heroValueFormatted,
    recoveryConservativeBrl: recovery.conservativeMonthlyBrl,
    recoveryOptimisticBrl: recovery.optimisticMonthlyBrl,
    recoveryRangeFormatted: execFin.heroRangeFormatted,
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
  seniorDerived?: SeniorDerived;
};

export function buildCommercialDerived(
  facts: Record<string, unknown> | null | undefined,
): CommercialDerived {
  const nicheFromFacts = facts?.niche_context as { nicheKey?: string } | undefined;
  const ctx = facts?.business_context as { niche?: string } | undefined;
  const nicheKey =
    (nicheFromFacts?.nicheKey as NicheBenchmarkKey | undefined) ??
    matchNicheFromContext(ctx?.niche ?? null);
  const gap =
    (facts?.account_financial_gap as AccountFinancialGap | undefined) ?? null;
  const gapMonthly = gap?.gapMonthlyBrl ?? 0;
  const economics = deriveAccountEconomics(facts);
  const waste = deriveWasteBreakdown(facts);
  const recovery = deriveRecoveryScenarios(waste, economics, facts, gapMonthly);
  const benchmarkComparison = deriveBenchmarkGaps(facts, nicheKey);
  const scoreExplanation = deriveScoreExplanation(facts);
  const storyExecutive = deriveStoryExecutive(waste, recovery, economics, facts, gap);
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
      primaryGapMonthlyBrl: commercial.storyExecutive.primaryGapMonthlyBrl,
      primaryGapMonthlyFormatted: commercial.storyExecutive.primaryGapMonthlyFormatted,
      heroRangeFormatted: commercial.storyExecutive.heroRangeFormatted,
      heroValueFormatted: commercial.storyExecutive.heroValueFormatted,
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
    seniorDerived: commercial.seniorDerived,
    maturity: commercial.seniorDerived?.maturity,
    leakByAxis: commercial.seniorDerived?.leakByAxis,
    growthScenarios: commercial.seniorDerived?.growthScenarios,
  };
}

export type { TopFinding } from "./derive-top-findings.ts";
export type { FinancialBalance } from "./derive-financial-balance.ts";
