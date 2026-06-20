/**
 * Meta Ads Growth Intelligence Engine v3 — 8 motores determinísticos (Enterprise 3.0).
 * Compõe consultative + commercial + senior; números em BRL só do servidor.
 */

import type { PrioritizedAction } from "./derive-action-priority.ts";
import { deriveActionPriority } from "./derive-action-priority.ts";
import { deriveAccountScore } from "./derive-account-score.ts";
import { computeRoas, num } from "./campaign-objective.ts";
import type { AccountFinancialGap } from "./derive-account-financial-gap.ts";
import type { AdsetBleedRow } from "./derive-adset-bleed.ts";
import type { ConsultativeDerived } from "./derive-consultative-blocks.ts";
import type {
  BenchmarkComparison,
  CommercialDerived,
} from "./derive-commercial.ts";
import type { DeliverySummary } from "./derive-delivery-summary.ts";
import type {
  GrowthScenarios,
  MaturityScore,
  SeniorDerived,
  SeniorRisk,
} from "./derive-senior-types.ts";
import {
  getAccountTrend,
  getAdsetTrend,
  type TrendVerdict,
} from "./derive-trends.ts";
export type ExecutiveImpact = {
  invested30d: number;
  investedFormatted: string;
  revenueActual: number | null;
  revenueActualFormatted: string;
  roasActual: number | null;
  roasActualFormatted: string;
  revenuePotential: number | null;
  revenuePotentialFormatted: string;
  gapMonthlyBrl: number;
  gapMonthlyFormatted: string;
  gapAnnualBrl: number;
  gapAnnualFormatted: string;
  headlinePt: string;
};

export type MoneyLeakCategory =
  | "structure"
  | "audience"
  | "creative"
  | "learning"
  | "saturation"
  | "budget"
  | "sales";

export type EvidenceStrength = {
  purchases: number;
  tier: "high" | "medium" | "low";
};

export type LeakTrend = {
  direction: "improving" | "stable" | "deteriorating" | "unknown";
  metric: "roas" | "cpa" | "ctr" | "cpm" | null;
  deltaPct: number | null;
  summaryPt: string | null;
  badge: string;
};

export type MoneyLeakItem = {
  id: string;
  title: string;
  monthlyImpactBrl: number;
  monthlyImpactFormatted: string;
  confidence: "high" | "medium" | "low";
  rootCause: string;
  action: string;
  priority: number;
  category: MoneyLeakCategory;
  entityName?: string;
  entityId?: string;
  evidenceStrength?: EvidenceStrength;
  trend?: LeakTrend;
};

export type GrowthOpportunityItem = {
  id: string;
  title: string;
  potentialMonthlyBrl: number | null;
  potentialFormatted: string;
  whyExists: string;
  howToCapture: string;
  estimatedEta: string;
  evidenceStrength?: EvidenceStrength;
};

export type GrowthRiskItem = {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  evidence: string;
  potentialImpactBrl: number | null;
  potentialImpactFormatted: string;
};

export type BenchmarkImpactItem = {
  metric: string;
  current: string;
  reference: string;
  tierNote: string;
  estimatedMonthlyImpactBrl: number | null;
  estimatedImpactFormatted: string;
};

export type EnterpriseMaturity = {
  score0to100: number;
  enterpriseLabel: string;
  levelLegacy: 1 | 2 | 3 | 4 | 5;
  summary: string;
  blockersToNextLevel: string[];
  pillars: MaturityScore["pillars"];
};

export type DecisionActionItem = {
  step: number;
  action: string;
  impactBrl: number | null;
  impactFormatted: string;
  eta: string;
  complexityWeight: number;
  priorityScore: number;
  confidence: "high" | "medium" | "low";
  urgency: PrioritizedAction["urgency"];
  effort: PrioritizedAction["effort"];
};

export type GrowthProjectionScenario = {
  key: "conservative" | "probable" | "aggressive";
  label: string;
  revenueUpliftPct: number;
  revenueUpliftFormatted: string;
  additionalRevenueMonthlyBrl: number | null;
  additionalRevenueFormatted: string;
  estimatedEta: string;
};

export type GrowthProjections = {
  disclaimer: string;
  scenarios: GrowthProjectionScenario[];
};

export type AccountHealthVerdict = {
  isHealthy: boolean;
  reasons: string[];
};

export type GrowthIntelligenceDerived = {
  executiveImpact: ExecutiveImpact;
  moneyLeaks: MoneyLeakItem[];
  growthOpportunities: GrowthOpportunityItem[];
  risks: GrowthRiskItem[];
  benchmarkImpacts: BenchmarkImpactItem[];
  maturity: EnterpriseMaturity;
  decisionActions: DecisionActionItem[];
  projections: GrowthProjections;
  accountHealth: AccountHealthVerdict;
  accountTrend?: LeakTrend | null;
};

function fmtBrl(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function enterpriseLabelFromScore(score: number): string {
  if (score <= 30) return "Iniciante";
  if (score <= 50) return "Operacional";
  if (score <= 70) return "Estruturada";
  if (score <= 85) return "Growth";
  return "Elite";
}

function effortWeight(effort: PrioritizedAction["effort"]): number {
  if (effort === "low") return 1;
  if (effort === "high") return 3;
  return 2;
}

function mapSeniorSeverity(s: SeniorRisk["severity"]): GrowthRiskItem["severity"] {
  if (s === "critical") return "critical";
  if (s === "warning") return "high";
  return "low";
}

function sumMoneyLeaks(leaks: MoneyLeakItem[]): number {
  return leaks.reduce((sum, leak) => sum + leak.monthlyImpactBrl, 0);
}

/** Item 1 — confiança estatística por volume de compras observado na evidência. */
export function evidenceStrengthFromPurchases(purchases: number): EvidenceStrength {
  const p = Math.max(0, Math.round(purchases));
  if (p >= 30) return { purchases: p, tier: "high" };
  if (p >= 10) return { purchases: p, tier: "medium" };
  return { purchases: p, tier: "low" };
}

function confidenceFromTier(
  tier: EvidenceStrength["tier"],
): MoneyLeakItem["confidence"] {
  if (tier === "high") return "high";
  if (tier === "medium") return "medium";
  return "low";
}

/** Conta compras (purchase / omni_purchase) num row de insights. */
function countPurchasesFromActions(actions: unknown): number {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  for (const a of actions as { action_type?: string; value?: string }[]) {
    if (/^purchase$|^omni_purchase$/i.test(a.action_type ?? "")) {
      total += num(a.value) ?? 0;
    }
  }
  return total;
}

/** Purchases atribuídas a um adset via facts.adsets_insights. */
function purchasesForAdset(
  facts: Record<string, unknown>,
  adsetId: string | null | undefined,
): number {
  if (!adsetId) return 0;
  const list = Array.isArray(facts.adsets_insights)
    ? (facts.adsets_insights as Record<string, unknown>[])
    : [];
  const row = list.find((r) => String(r.adset_id ?? "") === adsetId);
  return row ? countPurchasesFromActions(row.actions) : 0;
}

function trendFromVerdict(v: TrendVerdict): LeakTrend {
  const badge =
    v.direction === "deteriorating"
      ? "🔻 Em deterioração"
      : v.direction === "improving"
        ? "▲ Melhorando"
        : v.direction === "stable"
          ? "📊 Crônico"
          : "";
  return {
    direction: v.direction,
    metric: v.metric,
    deltaPct: v.deltaPct,
    summaryPt: v.summaryPt,
    badge,
  };
}



function syncStoryExecutiveGap(
  commercial: CommercialDerived,
  primaryGap: number,
): void {
  if (primaryGap <= commercial.storyExecutive.primaryGapMonthlyBrl) return;
  const recovery = commercial.recovery;
  const conservative =
    recovery.conservativeMonthlyBrl > 0
      ? recovery.conservativeMonthlyBrl
      : Math.round(primaryGap * 0.35);
  const optimistic =
    recovery.optimisticMonthlyBrl > 0 ? recovery.optimisticMonthlyBrl : primaryGap;
  const heroRange = `${fmtBrl(conservative)} – ${fmtBrl(optimistic)}`;
  commercial.storyExecutive.primaryGapMonthlyBrl = primaryGap;
  commercial.storyExecutive.primaryGapMonthlyFormatted = fmtBrl(primaryGap);
  commercial.storyExecutive.lossMonthlyBrl = primaryGap;
  commercial.storyExecutive.lossMonthlyFormatted = fmtBrl(primaryGap);
  commercial.storyExecutive.heroRangeFormatted = heroRange;
  commercial.storyExecutive.heroValueFormatted = heroRange;
  commercial.storyExecutive.recoveryRangeFormatted = heroRange;
}

function buildExecutiveImpact(
  gap: AccountFinancialGap | null,
  commercial: CommercialDerived,
  leakSum = 0,
): ExecutiveImpact {
  const econ = commercial.accountEconomics;
  const wasteGap = commercial.waste.totalMonthlyBrl;
  const gapFromMeta = gap?.gapMonthlyBrl ?? 0;
  const primaryGap = Math.max(gapFromMeta, wasteGap, leakSum);
  if (gap) {
    return {
      invested30d: gap.invested30d,
      investedFormatted: gap.investedFormatted,
      revenueActual: gap.revenueActual,
      revenueActualFormatted: gap.revenueActualFormatted,
      roasActual: gap.roasActual,
      roasActualFormatted: gap.roasActualFormatted,
      revenuePotential: gap.revenuePotential,
      revenuePotentialFormatted: gap.revenuePotentialFormatted,
      gapMonthlyBrl: primaryGap,
      gapMonthlyFormatted: fmtBrl(primaryGap),
      gapAnnualBrl: primaryGap * 12,
      gapAnnualFormatted: fmtBrl(primaryGap * 12),
      headlinePt: gap.headlinePt,
    };
  }
  return {
    invested30d: econ.spend30d,
    investedFormatted: econ.spendFormatted,
    revenueActual: econ.revenue30d,
    revenueActualFormatted: econ.revenueFormatted,
    roasActual: econ.roasSales,
    roasActualFormatted: econ.roasFormatted,
    revenuePotential: null,
    revenuePotentialFormatted: "—",
    gapMonthlyBrl: 0,
    gapMonthlyFormatted: fmtBrl(0),
    gapAnnualBrl: 0,
    gapAnnualFormatted: fmtBrl(0),
    headlinePt: `Investimento de ${econ.spendFormatted} no período — gap financeiro depende de vendas rastreadas.`,
  };
}

function buildMoneyLeaks(
  consultative: ConsultativeDerived | null,
  commercial: CommercialDerived,
  senior: SeniorDerived | undefined,
  facts: Record<string, unknown>,
): MoneyLeakItem[] {
  const leaks: MoneyLeakItem[] = [];
  let rank = 0;

  const funnel = consultative?.conversionFunnel;
  if (funnel?.revenueAtRiskMonthlyBrl && funnel.revenueAtRiskMonthlyBrl >= 30) {
    const bn = funnel.bottleneck;
    let id = "funnel:checkout";
    let title = "Abandono no checkout — receita não capturada";
    let action =
      "Otimizar checkout/UX — o Meta já entrega intenção; o gargalo está no site.";
    let rootCause = funnel.bottleneckLabel;
    if (bn === "atc") {
      id = "funnel:atc";
      title = "Abandono no carrinho — receita não capturada";
      action = "Reduzir atrito entre carrinho e checkout — frete, login, cupons.";
    } else if (bn === "checkout_late") {
      id = "funnel:checkout_late";
      title = "Abandono na finalização (após inserir pagamento)";
      rootCause =
        `${funnel.bottleneckLabel} Quem chegou até aqui já decidiu comprar — perda mais cara do funil. ` +
        (funnel.bottleneckDetail ?? "");
      action =
        "Auditar gateway de pagamento, adicionar Pix/parcelamento, revelar frete antes do último passo e revisar timeout de sessão.";
    } else if (bn === "checkout_early") {
      id = "funnel:checkout_early";
      title = "Abandono no início do checkout (antes do pagamento)";
      rootCause = `${funnel.bottleneckLabel} ${funnel.bottleneckDetail ?? ""}`.trim();
      action =
        "Simplificar primeira tela do checkout, mostrar frete antes de pedir dados e remover exigência de cadastro obrigatório.";
    } else if (bn === "checkout" && !funnel.paymentInfoTracked) {
      rootCause =
        `${funnel.bottleneckLabel} Evento add_payment_info não rastreado — instale no Pixel/CAPI para distinguir abandono antes vs depois do pagamento.`;
    }
    leaks.push({
      id,
      title,
      monthlyImpactBrl: funnel.revenueAtRiskMonthlyBrl,
      monthlyImpactFormatted: fmtBrl(funnel.revenueAtRiskMonthlyBrl),
      confidence: "high",
      rootCause,
      action,
      priority: 0,
      category: "structure",
    });
  }

  const adsetInsights = Array.isArray(facts.adsets_insights)
    ? (facts.adsets_insights as Record<string, unknown>[])
    : [];
  const spendByAdset = new Map<string, number>();
  for (const r of adsetInsights) {
    const id = String(r.adset_id ?? "");
    if (id) spendByAdset.set(id, num(r.spend) ?? 0);
  }

  for (const row of consultative?.adsetLearningStatus ?? []) {
    if (row.learning_status !== "learning_fail") continue;
    const spend = spendByAdset.get(row.adset_id) ?? 0;
    if (spend < 100) continue;
    const impact = Math.round(spend * 0.5);
    const purchases = purchasesForAdset(facts, row.adset_id);
    const ev = evidenceStrengthFromPurchases(purchases);
    leaks.push({
      id: `learning:${row.adset_id}`,
      title: `Learning fail — ${row.adset_name.slice(0, 60)}`,
      monthlyImpactBrl: impact,
      monthlyImpactFormatted: fmtBrl(impact),
      confidence: confidenceFromTier(ev.tier),
      rootCause: row.issues_summary?.join("; ") || "Conjunto saiu do aprendizado sem otimização plena.",
      action: "Consolidar volume, revisar público/criativo ou pausar antes de escalar.",
      priority: 0,
      category: "learning",
      entityName: row.adset_name,
      entityId: row.adset_id,
      evidenceStrength: ev,
    });
  }

  const adsTop = Array.isArray(facts.ads_insights_top)
    ? (facts.ads_insights_top as Record<string, unknown>[])
    : [];
  for (const ad of adsTop) {
    const spend = num(ad.spend) ?? 0;
    if (spend < 200) continue;
    const purchases = countPurchasesFromActions(ad.actions);
    const roas = computeRoas(ad.action_values, spend);
    if (purchases > 1) continue;
    const impact = Math.round(spend * (purchases === 0 ? 0.85 : 0.55));
    if (impact < 80) continue;
    const adName = String(ad.ad_name ?? ad.ad_id ?? "anúncio").slice(0, 60);
    const ev = evidenceStrengthFromPurchases(purchases);
    leaks.push({
      id: `ad-bleed:${String(ad.ad_id ?? adName)}`,
      title: `Criativo ineficiente — ${adName}`,
      monthlyImpactBrl: impact,
      monthlyImpactFormatted: fmtBrl(impact),
      // Sem compras é evidência baixa — não prescrever escala.
      confidence: confidenceFromTier(ev.tier),
      rootCause:
        purchases === 0
          ? `${fmtBrl(spend)} gastos sem compra rastreada no período (evidência ainda inicial).`
          : `${fmtBrl(spend)} para ${purchases} compra — ROAS ${roas != null ? `${roas.toFixed(1)}×` : "baixo"}.`,
      action:
        ev.tier === "low"
          ? "Sinal inicial — validar com +7 dias antes de pausar ou substituir o criativo."
          : "Pausar ou substituir criativo; redistribuir verba para vencedores.",
      priority: 0,
      category: "creative",
      entityName: adName,
      evidenceStrength: ev,
    });
  }

  const bleedRows = (consultative?.adsetBleedRanking ?? []).filter((r) => r.bleedBrl >= 50);
  if (bleedRows.length) {
    const [worst, ...rest] = bleedRows;
    const worstPurchases = purchasesForAdset(facts, worst.adsetId);
    const worstEv = evidenceStrengthFromPurchases(worstPurchases);
    leaks.push({
      id: `bleed:${worst.adsetId}`,
      title: `${worst.adsetName} — ROAS ${worst.roasFormatted} vs nicho`,
      monthlyImpactBrl: worst.bleedBrl,
      monthlyImpactFormatted: worst.bleedFormatted,
      confidence:
        worst.bleedBrl >= 500 && worstEv.tier !== "low"
          ? "high"
          : worstEv.tier === "low"
            ? "low"
            : "medium",
      rootCause: `ROAS ${worst.roasFormatted} em campanha de Vendas; ${worst.spendFormatted} investidos no período${worstPurchases > 0 ? ` (${worstPurchases} compra${worstPurchases > 1 ? "s" : ""} observada${worstPurchases > 1 ? "s" : ""})` : " — ainda sem compras rastreadas suficientes"}.`,
      action:
        worstEv.tier === "low"
          ? "Sinal direcional — coletar +7 dias antes de pausar ou reestruturar."
          : "Reduzir verba, pausar ou reestruturar público/criativo neste conjunto.",
      priority: 0,
      category: "sales",
      entityName: worst.adsetName,
      entityId: worst.adsetId,
      evidenceStrength: worstEv,
    });
    if (rest.length) {
      const sum = rest.reduce((s, r) => s + r.bleedBrl, 0);
      const names = rest.slice(0, 3).map((r) => r.adsetName).join(", ");
      const suffix = rest.length > 3 ? ` e mais ${rest.length - 3}` : "";
      leaks.push({
        id: "bleed:rest",
        title: `Outros conjuntos de Vendas abaixo do nicho (n=${rest.length})`,
        monthlyImpactBrl: sum,
        monthlyImpactFormatted: fmtBrl(sum),
        confidence: "medium",
        rootCause: `${names}${suffix}.`,
        action: "Consolidar verba nos vencedores ou pausar os ineficientes em bloco.",
        priority: 0,
        category: "sales",
      });
    }
  }

  for (const line of commercial.waste.lines) {
    if (line.monthlyBrl < 30) continue;
    const axis = senior?.leakByAxis.find((l) =>
      line.campaignNames.some((n) => l.evidence.includes(n))
    );
    const category: MoneyLeakCategory =
      axis?.axis === "audience"
        ? "audience"
        : axis?.axis === "creative"
          ? "creative"
          : axis?.axis === "sales"
            ? "sales"
            : "structure";
    leaks.push({
      id: `waste:${rank++}`,
      title: line.label,
      monthlyImpactBrl: line.monthlyBrl,
      monthlyImpactFormatted: fmtBrl(line.monthlyBrl),
      confidence: "medium",
      rootCause: line.campaignNames.slice(0, 2).join(", ") || line.label,
      action: "Corrigir campanhas listadas ou redistribuir verba.",
      priority: 0,
      category,
    });
  }

  const delivery = consultative?.deliverySummary;
  if (delivery && delivery.estimatedDailyBlindSpendBrl > 0) {
    const monthly = Math.round(delivery.estimatedDailyBlindSpendBrl * 30);
    const hasLearningNamed = leaks.some((l) => l.id.startsWith("learning:"));
    if (!hasLearningNamed) {
      leaks.push({
        id: "delivery:learning",
        title: "Verba em conjuntos em aprendizado ou com limitações",
        monthlyImpactBrl: monthly,
        monthlyImpactFormatted: fmtBrl(monthly),
        confidence: "medium",
        rootCause: delivery.summaryPt,
        action: "Consolidar conjuntos antes de escalar; evitar fragmentação excessiva.",
        priority: 0,
        category: "learning",
      });
    }
  }

  for (const item of senior?.leakByAxis ?? []) {
    if (leaks.some((l) => l.monthlyImpactBrl === item.monthlyBrl && l.title.includes(item.axisLabel))) {
      continue;
    }
    const category: MoneyLeakCategory =
      item.axis === "audience"
        ? "saturation"
        : item.axis === "creative"
          ? "creative"
          : item.axis === "sales"
            ? "sales"
            : "structure";
    leaks.push({
      id: `axis:${item.axis}`,
      title: item.headline,
      monthlyImpactBrl: item.monthlyBrl,
      monthlyImpactFormatted: item.monthlyFormatted,
      confidence: item.severity === "critical" ? "high" : "medium",
      rootCause: item.evidence,
      action: `Priorizar eixo ${item.axisLabel} no Gerenciador.`,
      priority: 0,
      category,
    });
  }

  leaks.sort((a, b) => b.monthlyImpactBrl - a.monthlyImpactBrl);
  const diversified = diversifyTopLeaks(leaks, 3);
  return diversified.map((l, i) => ({ ...l, priority: i + 1 }));
}

/**
 * Reordena para que o top-N cubra pelo menos 2 categorias quando possível,
 * preservando #1 (maior impacto) e promovendo a próxima categoria distinta para #2.
 */
function diversifyTopLeaks(
  leaks: MoneyLeakItem[],
  topN: number,
): MoneyLeakItem[] {
  if (leaks.length <= 1) return leaks;
  const out = [...leaks];
  for (let i = 1; i < Math.min(topN, out.length); i++) {
    const prevCategories = new Set(out.slice(0, i).map((l) => l.category));
    if (!prevCategories.has(out[i].category)) continue;
    // Procurar a partir de i+1 a primeira entrada de categoria nova
    const swapIdx = out.findIndex(
      (l, idx) => idx > i && !prevCategories.has(l.category),
    );
    if (swapIdx === -1) continue;
    const [picked] = out.splice(swapIdx, 1);
    out.splice(i, 0, picked);
  }
  return out;
}

function buildGrowthOpportunities(
  consultative: ConsultativeDerived | null,
  commercial: CommercialDerived,
  senior: SeniorDerived | undefined,
  facts: Record<string, unknown>,
  health: AccountHealthVerdict,
): GrowthOpportunityItem[] {
  const out: GrowthOpportunityItem[] = [];
  const recovery = commercial.recovery.conservativeMonthlyBrl;
  const winnerRaw = facts.adset_winner_underinvested as
    | { adId?: string; adName?: string; roas?: number; spend?: number; spendNote?: string }
    | undefined;
  const winner = consultative?.winnerUnderinvested ?? null;

  if (winner) {
    // Item 1 — confiança estatística por número de compras do criativo vencedor.
    const adsTop = Array.isArray(facts.ads_insights_top)
      ? (facts.ads_insights_top as Record<string, unknown>[])
      : [];
    const adId = winnerRaw?.adId ?? null;
    const matched = adId
      ? adsTop.find((a) => String(a.ad_id ?? "") === adId)
      : adsTop.find((a) => String(a.ad_name ?? "") === winner.adName);
    const purchases = matched ? countPurchasesFromActions(matched.actions) : 0;
    const ev = evidenceStrengthFromPurchases(purchases);

    const winnerSpend = (winnerRaw?.spend ?? 0) || 0;
    const uplift = Math.round(winnerSpend * Math.max(0, winner.roas - 1) * 2);
    const titleVerb =
      ev.tier === "high"
        ? "Escalar criativo vencedor"
        : ev.tier === "medium"
          ? "Validar e escalar criativo promissor"
          : "Validar sinal inicial do criativo";
    const howToCapture =
      ev.tier === "low"
        ? `Sinal direcional (${ev.purchases} compra${ev.purchases === 1 ? "" : "s"} no período). Subir verba em +30% por 7 dias antes de escalar agressivamente; manter conjunto dedicado a ${winner.adName} (ROAS ${winner.roas.toFixed(1)}×).`
        : ev.tier === "medium"
          ? `Evidência média (${ev.purchases} compras). Isolar ${winner.adName} em conjunto dedicado com orçamento próprio (ROAS ${winner.roas.toFixed(1)}×) e dobrar verba apenas após +14 dias estáveis.`
          : `Criar conjunto dedicado com orçamento exclusivo para ${winner.adName} (ROAS ${winner.roas.toFixed(1)}×); evidência sólida (${ev.purchases} compras) — pode escalar agora.`;
    out.push({
      id: "winner-underinvested",
      title: `${titleVerb}: ${winner.adName}`,
      potentialMonthlyBrl: uplift > 0 ? uplift : null,
      potentialFormatted: uplift > 0 ? fmtBrl(uplift) : "—",
      whyExists: winner.spendNote,
      howToCapture,
      estimatedEta: ev.tier === "low" ? "7–14 dias (validação)" : "3–7 dias",
      evidenceStrength: ev,
    });
  }

  const gs = senior?.growthScenarios;
  const namedBleeds = (consultative?.adsetBleedRanking ?? []).filter((r) => r.bleedBrl >= 50);
  const namedAxis = (senior?.leakByAxis ?? []).find((a) =>
    a.evidence && /[A-Za-zÀ-ÿ]/.test(a.evidence) && a.monthlyBrl > 0,
  );
  // Item 3 — em conta saudável, troca o enquadramento de "recuperar eficiência"
  // para "subir do bom para o excepcional".
  if (gs && recovery > 0 && (winner || namedBleeds.length >= 2 || namedAxis)) {
    const targets = namedBleeds.slice(0, 2).map((b) => b.adsetName).join(", ");
    const title = health.isHealthy
      ? "Subir do bom para o excepcional — teto disponível"
      : targets
        ? `Realocar verba dos conjuntos ${targets} para vencedores`
        : namedAxis
          ? `Recuperar eficiência no eixo ${namedAxis.axisLabel}`
          : "Reinvestir verba liberada no criativo vencedor";
    out.push({
      id: "recovery-headroom",
      title,
      potentialMonthlyBrl: recovery,
      potentialFormatted: fmtBrl(recovery),
      whyExists: gs.basisNote,
      howToCapture: health.isHealthy
        ? "Conta já no top do nicho — usar verba liberada para testar novos públicos/criativos e ampliar teto, não para corrigir."
        : targets
          ? `Pausar/reduzir ${targets} e realocar verba para conjuntos com ROAS acima do nicho.`
          : "Executar plano de correção nos eixos com maior vazamento antes de escalar.",
      estimatedEta: "30 dias",
    });
  }

  if (consultative?.conversionFunnel?.revenueAtRiskMonthlyBrl) {
    const cf = consultative.conversionFunnel;
    const r = cf.revenueAtRiskMonthlyBrl!;
    const isLate = cf.bottleneck === "checkout_late";
    const isEarly = cf.bottleneck === "checkout_early";
    out.push({
      id: isLate ? "funnel-checkout-late" : isEarly ? "funnel-checkout-early" : "funnel-checkout",
      title: isLate
        ? "Recuperar compras travadas na finalização"
        : isEarly
          ? "Reduzir abandono antes do pagamento"
          : "Recuperar compras no checkout (site)",
      potentialMonthlyBrl: r,
      potentialFormatted: fmtBrl(r),
      whyExists: cf.bottleneckLabel,
      howToCapture: isLate
        ? "Auditar gateway, adicionar Pix/parcelamento e revelar frete antes do último passo."
        : isEarly
          ? "Simplificar primeira tela do checkout, mostrar frete antes e remover cadastro obrigatório."
          : "Otimizar checkout/UX — o Meta já entrega intenção; o gargalo está fora dos anúncios.",
      estimatedEta: "2–4 semanas",
    });
  }

  return out.slice(0, 6);
}

function buildRisks(
  senior: SeniorDerived | undefined,
  delivery: DeliverySummary | null,
  commercial: CommercialDerived,
): GrowthRiskItem[] {
  const risks: GrowthRiskItem[] = [];
  for (const r of senior?.risks ?? []) {
    const leak = senior?.leakByAxis.find((l) => l.axis === r.relatedAxis);
    const impact = leak?.monthlyBrl ?? Math.round(commercial.waste.totalMonthlyBrl * 0.15);
    risks.push({
      id: r.id,
      title: r.title,
      severity: mapSeniorSeverity(r.severity),
      evidence: r.evidence,
      potentialImpactBrl: impact > 0 ? impact : null,
      potentialImpactFormatted: impact > 0 ? fmtBrl(impact) : "—",
    });
  }
  if (delivery && delivery.pctSpendNonOptimized >= 15) {
    risks.push({
      id: "delivery-blind-spend",
      title: "Parcela relevante do budget sem otimização plena",
      severity: delivery.pctSpendNonOptimized >= 25 ? "high" : "medium",
      evidence: delivery.summaryPt,
      potentialImpactBrl: Math.round(delivery.estimatedDailyBlindSpendBrl * 30),
      potentialImpactFormatted: delivery.estimatedDailyBlindSpendFormatted.replace(
        /\/dia/,
        "/mês est.",
      ),
    });
  }
  return risks;
}

function estimateBenchmarkImpactBrl(
  gap: BenchmarkComparison["gaps"][0],
  spend30d: number,
): number | null {
  if (!gap.isBad || gap.deltaPct == null || spend30d <= 0) return null;
  const pct = Math.min(40, gap.deltaPct) / 100;
  return Math.round(spend30d * pct * 0.35);
}

function buildBenchmarkImpacts(
  commercial: CommercialDerived,
): BenchmarkImpactItem[] {
  const spend = commercial.accountEconomics.spend30d;
  return commercial.benchmarkComparison.gaps.map((g) => {
    const brl = estimateBenchmarkImpactBrl(g, spend);
    return {
      metric: g.metric,
      current: g.current,
      reference: g.reference,
      tierNote: g.gapNote,
      estimatedMonthlyImpactBrl: brl,
      estimatedImpactFormatted: brl != null ? fmtBrl(brl) : "—",
    };
  });
}

function buildEnterpriseMaturity(
  maturity: MaturityScore,
  accountScore: number,
): EnterpriseMaturity {
  const score0to100 = Math.max(0, Math.min(100, Math.round(accountScore)));
  const enterpriseLabel = enterpriseLabelFromScore(score0to100);
  const blockers: string[] = [];
  for (const p of maturity.pillars) {
    if (p.score < 55) blockers.push(`${p.label}: ${p.detail}`);
  }
  if (maturity.level < 5 && blockers.length === 0) {
    blockers.push("Consolidar testes criativos e escala controlada para subir de nível.");
  }
  return {
    score0to100,
    enterpriseLabel,
    levelLegacy: maturity.level,
    summary: maturity.summary,
    blockersToNextLevel: blockers.slice(0, 4),
    pillars: maturity.pillars,
  };
}

function buildDecisionActions(
  senior: SeniorDerived | undefined,
  facts: Record<string, unknown>,
): DecisionActionItem[] {
  if (!senior) return [];
  const seeds = Array.isArray(facts.hypothesis_seeds)
    ? (facts.hypothesis_seeds as Parameters<typeof deriveActionPriority>[2])
    : [];
  const rawPlan = Array.isArray(facts.prioritized_actions)
    ? (facts.prioritized_actions as PrioritizedAction[])
    : undefined;
  const prioritized = deriveActionPriority(senior, rawPlan, seeds);
  return prioritized.map((a, i) => {
    const w = effortWeight(a.effort);
    const impact = a.impactBrl ?? 0;
    const priorityScore = impact > 0 ? Math.round(impact / w) : 0;
    return {
      step: i + 1,
      action: a.action,
      impactBrl: a.impactBrl,
      impactFormatted: a.impactBrl != null ? fmtBrl(a.impactBrl) : "—",
      eta: a.eta,
      complexityWeight: w,
      priorityScore,
      confidence: a.urgency === "now" ? "high" : "medium",
      urgency: a.urgency,
      effort: a.effort,
    };
  });
}

function buildProjections(
  commercial: CommercialDerived,
  gs: GrowthScenarios | undefined,
): GrowthProjections {
  const revenue = commercial.accountEconomics.revenue30d;
  const disclaimer =
    "Cenários indicativos com base em recuperação de desperdício e headroom observado — não são garantia de resultado.";
  if (!gs) {
    return { disclaimer, scenarios: [] };
  }
  const mk = (
    key: GrowthProjectionScenario["key"],
    label: string,
    pct: number,
  ): GrowthProjectionScenario => {
    const additional =
      revenue != null && revenue > 0 ? Math.round(revenue * (pct / 100)) : null;
    return {
      key,
      label,
      revenueUpliftPct: pct,
      revenueUpliftFormatted: `+${pct}%`,
      additionalRevenueMonthlyBrl: additional,
      additionalRevenueFormatted: additional != null ? fmtBrl(additional) : "—",
      estimatedEta: key === "conservative" ? "60–90 dias" : key === "probable" ? "30–60 dias" : "30 dias",
    };
  };
  return {
    disclaimer,
    scenarios: [
      mk("conservative", "Conservador", gs.conservativePct),
      mk("probable", "Provável", gs.probablePct),
      mk("aggressive", "Agressivo", gs.aggressivePct),
    ],
  };
}

/** Item 3 — Detecta conta saudável (sem gargalo crítico, ROAS dentro/acima do nicho). */
function evaluateAccountHealth(
  facts: Record<string, unknown>,
  commercial: CommercialDerived,
  gapFromMeta: number,
  score: number,
  consultative: ConsultativeDerived | null,
): AccountHealthVerdict {
  const reasons: string[] = [];
  const econ = commercial.accountEconomics;
  const revenue = econ.revenue30d ?? 0;
  const gapShare = revenue > 0 ? gapFromMeta / revenue : 1;

  const roasGap = commercial.benchmarkComparison.gaps.find(
    (g) => /roas/i.test(g.metric),
  );
  const roasOk = !roasGap || !roasGap.isBad;

  const funnel = consultative?.conversionFunnel;
  const hasFunnelLeak =
    !!funnel?.revenueAtRiskMonthlyBrl && funnel.revenueAtRiskMonthlyBrl >= 100;

  const criticalRisks =
    (commercial.seniorDerived?.risks ?? []).filter((r) => r.severity === "critical").length;

  const isHealthy =
    score >= 80 &&
    roasOk &&
    gapShare <= 0.1 &&
    !hasFunnelLeak &&
    criticalRisks === 0;

  if (score >= 80) reasons.push(`Score ${score} ≥ 80`);
  if (roasOk) reasons.push("ROAS dentro ou acima do nicho");
  if (gapShare <= 0.1) reasons.push("Gap ≤ 10% da receita mensal");
  if (!hasFunnelLeak) reasons.push("Sem gargalo de funil relevante");
  if (criticalRisks === 0) reasons.push("Sem risco crítico aberto");

  return { isHealthy, reasons };
}

/** Anexa trend a cada leak com entityId (adset). */
function attachTrendsToLeaks(
  leaks: MoneyLeakItem[],
  facts: Record<string, unknown>,
): void {
  for (const l of leaks) {
    if (!l.entityId) continue;
    const v = getAdsetTrend(facts, l.entityId);
    if (v.direction === "unknown") continue;
    l.trend = trendFromVerdict(v);
    // 🔻 prefixar título quando em deterioração, sem duplicar
    if (
      v.direction === "deteriorating" &&
      !l.title.startsWith("🔻") &&
      !l.title.startsWith("📊")
    ) {
      l.title = `🔻 ${l.title}`;
    } else if (
      v.direction === "stable" &&
      !l.title.startsWith("🔻") &&
      !l.title.startsWith("📊")
    ) {
      l.title = `📊 ${l.title}`;
    }
    // Embute a frase de tendência na rootCause para a IA citar.
    if (l.trend.summaryPt && !l.rootCause.includes(l.trend.summaryPt)) {
      l.rootCause = `${l.rootCause} ${l.trend.summaryPt}.`.trim();
    }
  }
}

export function buildGrowthIntelligenceDerived(
  facts: Record<string, unknown>,
  commercial: CommercialDerived,
): GrowthIntelligenceDerived {
  const consultative = facts.consultative_derived as ConsultativeDerived | undefined;
  const senior = commercial.seniorDerived;
  const gap = consultative?.accountFinancialGap ?? null;
  const scoreVal = deriveAccountScore(facts).score;

  const moneyLeaksRaw = buildMoneyLeaks(consultative ?? null, commercial, senior, facts);
  // Item 2 — trends por adset
  attachTrendsToLeaks(moneyLeaksRaw, facts);

  // Conciliar com gap da conta — se gap agregado > soma dos leaks atribuídos,
  // adicionar UMA entrada residual para o leitor não fazer dupla contagem.
  const gapFromMeta = gap?.gapMonthlyBrl ?? 0;
  const attributedSum = sumMoneyLeaks(moneyLeaksRaw);
  let moneyLeaks = [...moneyLeaksRaw];
  if (gapFromMeta > 0 && gapFromMeta - attributedSum >= 100) {
    const residual = gapFromMeta - attributedSum;
    moneyLeaks.push({
      id: "gap:residual",
      title: "Gap agregado vs ROAS do nicho — não atribuído a conjuntos específicos",
      monthlyImpactBrl: residual,
      monthlyImpactFormatted: fmtBrl(residual),
      confidence: "medium",
      rootCause:
        "Diferença entre o gap total da conta (spend × ROAS_nicho − receita) e os vazamentos atribuídos a conjuntos/criativos.",
      action: "Reduzir verba das campanhas com ROAS abaixo do nicho enquanto isola vencedores.",
      priority: moneyLeaks.length + 1,
      category: "sales",
    });
  }

  // Item 3 — modo conta saudável: limitar leaks a no máximo 1.
  const health = evaluateAccountHealth(
    facts,
    commercial,
    gapFromMeta,
    scoreVal,
    consultative ?? null,
  );
  if (health.isHealthy && moneyLeaks.length > 1) {
    moneyLeaks = moneyLeaks.slice(0, 1);
  }

  const leakSum = sumMoneyLeaks(moneyLeaks);
  syncStoryExecutiveGap(commercial, Math.max(gapFromMeta, commercial.waste.totalMonthlyBrl, leakSum));
  const executiveImpact = buildExecutiveImpact(gap, commercial, leakSum);

  // Item 3 — headline da conta saudável.
  if (health.isHealthy) {
    const roasOk = commercial.accountEconomics.roasFormatted;
    const ceilingBrl =
      commercial.recovery.conservativeMonthlyBrl > 0
        ? commercial.recovery.conservativeMonthlyBrl
        : leakSum;
    executiveImpact.headlinePt =
      ceilingBrl > 0
        ? `Conta no top do nicho (ROAS ${roasOk}) — teto disponível de ${fmtBrl(ceilingBrl)}/mês para subir do bom para o excepcional.`
        : `Conta no top do nicho (ROAS ${roasOk}) — sem vazamentos críticos. Foco em escala, não em correção.`;
  }

  const growthOpportunities = buildGrowthOpportunities(
    consultative ?? null,
    commercial,
    senior,
    facts,
    health,
  );
  const risks = buildRisks(senior, consultative?.deliverySummary ?? null, commercial);
  const benchmarkImpacts = buildBenchmarkImpacts(commercial);
  const maturity = buildEnterpriseMaturity(
    senior?.maturity ?? {
      level: 3,
      label: "Intermediário",
      summary: "Dados limitados para maturidade.",
      pillars: [],
    },
    scoreVal,
  );
  const decisionActions = buildDecisionActions(senior, facts);
  const projections = buildProjections(commercial, senior?.growthScenarios);

  // Item 2 — trend da conta no payload.
  const accountVerdict = getAccountTrend(facts);
  const accountTrend =
    accountVerdict.direction === "unknown" ? null : trendFromVerdict(accountVerdict);

  const out: GrowthIntelligenceDerived = {
    executiveImpact,
    moneyLeaks,
    growthOpportunities,
    risks,
    benchmarkImpacts,
    maturity,
    decisionActions,
    projections,
    accountHealth: health,
    accountTrend,
  };
  facts.growth_intelligence_derived = out;
  return out;
}
