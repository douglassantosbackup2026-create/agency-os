/**
 * Derivação determinística do analysis_json (v2 — por objetivo de campanha).
 */

import {
  type CampaignEnriched,
  type DerivedStatus,
  type ObjectiveFamily,
  computeRoas,
  computeSpendMix,
  enrichCampaigns,
  labelFamilyPt,
  num,
} from "./campaign-objective.ts";
import {
  buildCommercialDerived,
  commercialToAnalysisFields,
} from "./derive-commercial.ts";
import {
  deriveActionPriority,
  topActionsNow,
} from "./derive-action-priority.ts";
import {
  deriveBusinessHints,
  type BusinessContextInput,
} from "./derive-business-hints.ts";
import {
  calcularImpactoCheckout,
  referenciaIdeal,
  ticketMedioReferencia,
} from "./benchmark-loader.ts";
import { resolveNicheContext } from "./derive-niche-context.ts";
export { deriveAccountScore, deriveScoreV2 } from "./derive-account-score.ts";
import { deriveScoreV2 } from "./derive-account-score.ts";
import { deriveHypothesisSeeds } from "./derive-hypothesis-seeds.ts";
import { buildSeniorDerived } from "./derive-senior.ts";
import type { SeniorDerived } from "./derive-senior-types.ts";
import { attachMetaSeniorToFacts } from "./derive-meta-senior.ts";
import { buildConsultativeDerived } from "./derive-consultative-blocks.ts";
import { buildGrowthIntelligenceDerived } from "./derive-growth-intelligence.ts";

export type { DerivedStatus };

function fmtBRL(n: number | null): string {
  if (n == null) return "—";
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2).replace(".", ",")}%`;
}

function fmtX(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2).replace(".", ",")}x`;
}

function fmtNum(n: number | null, dec = 2): string {
  if (n == null) return "—";
  return n.toFixed(dec).replace(".", ",");
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
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

export type CampaignBreakdownRowV2 = {
  name: string;
  objective_label: string;
  result_label: string;
  results_count: string;
  cost_per_result: string;
  spend: string;
  roas: string;
  ctr: string;
  cpm: string;
  frequency: string;
  status: DerivedStatus;
  status_reason: string;
};

export function deriveCampaignBreakdownV2(
  facts: Record<string, unknown> | null | undefined,
): { rows: CampaignBreakdownRowV2[]; totalSpend: number } {
  const enriched = getEnriched(facts);
  const rows: CampaignBreakdownRowV2[] = enriched.slice(0, 12).map((c) => {
    const pr = c.primary_result;
    const costStr =
      pr.cost_per_result != null
        ? c.family === "awareness" && pr.kind === "reach"
          ? `${fmtBRL(pr.cost_per_result)} / 1k`
          : fmtBRL(pr.cost_per_result)
        : "—";
    return {
      name: c.name,
      objective_label: c.family_label_pt,
      result_label: pr.label_pt,
      results_count: pr.count > 0 ? fmtCount(pr.count) : "—",
      cost_per_result: costStr,
      spend: fmtBRL(c.spend),
      roas: c.roas != null ? fmtX(c.roas) : "—",
      ctr: fmtPct(c.ctr_link),
      cpm: fmtBRL(c.cpm),
      frequency: fmtNum(c.frequency),
      status: c.kpi_status,
      status_reason: c.kpi_status_reason,
    };
  });
  const totalSpend = enriched.reduce((s, c) => s + c.spend, 0);
  return { rows, totalSpend };
}

export type AccountObjectiveSummary = {
  mixed_funnel: boolean;
  sales_block: {
    spend: number;
    spend_formatted: string;
    roas: number | null;
    roas_formatted: string;
    cpa: number | null;
    cpa_formatted: string;
    purchases: number;
    campaign_count: number;
  } | null;
  by_family: {
    family: ObjectiveFamily;
    label: string;
    spend_pct: number;
    spend_formatted: string;
    headline_kpi: string;
  }[];
};

export function deriveAccountObjectiveSummary(
  facts: Record<string, unknown> | null | undefined,
): AccountObjectiveSummary {
  const enriched = getEnriched(facts);
  const mix = computeSpendMix(enriched);
  const families = Object.keys(mix) as ObjectiveFamily[];
  const mixed_funnel = families.length > 1;

  const salesCamps = enriched.filter((c) => c.family === "sales");
  let sales_block: AccountObjectiveSummary["sales_block"] = null;
  if (salesCamps.length > 0) {
    let rev = 0;
    let purchases = 0;
    let spend = 0;
    for (const c of salesCamps) {
      spend += c.spend;
      purchases += c.primary_result.kind === "purchase"
        ? c.primary_result.count
        : 0;
      if (c.roas != null && c.spend > 0) {
        rev += c.roas * c.spend;
      }
    }
    const roas = spend > 0 && rev > 0 ? rev / spend : null;
    const cpa = purchases > 0 && spend > 0 ? spend / purchases : null;
    sales_block = {
      spend,
      spend_formatted: fmtBRL(spend),
      roas,
      roas_formatted: roas != null ? fmtX(roas) : "—",
      cpa,
      cpa_formatted: cpa != null ? fmtBRL(cpa) : "—",
      purchases,
      campaign_count: salesCamps.length,
    };
  }

  const by_family: AccountObjectiveSummary["by_family"] = [];
  const familyOrder: ObjectiveFamily[] = [
    "sales",
    "traffic",
    "awareness",
    "leads",
    "engagement",
    "app",
    "other",
  ];
  for (const family of familyOrder) {
    const pct = mix[family];
    if (pct == null || pct <= 0) continue;
    const camps = enriched.filter((c) => c.family === family);
    const spend = camps.reduce((s, c) => s + c.spend, 0);
    const best = camps[0];
    let headline = `${labelFamilyPt(family)} — ${fmtBRL(spend)} gastos`;
    if (best) {
      const pr = best.primary_result;
      if (best.roas != null) headline += ` · ROAS ${fmtX(best.roas)}`;
      else if (pr.cost_per_result != null) {
        headline += ` · ${pr.label_pt} ${fmtBRL(pr.cost_per_result)}`;
      }
    }
    by_family.push({
      family,
      label: labelFamilyPt(family),
      spend_pct: Math.round(pct * 1000) / 10,
      spend_formatted: fmtBRL(spend),
      headline_kpi: headline,
    });
  }

  return { mixed_funnel, sales_block, by_family };
}

export function deriveMetricsFromFactsV2(
  facts: Record<string, unknown> | null | undefined,
): {
  metrics: { name: string; current: string; reference: string; status: DerivedStatus }[];
  account_context_metrics: { name: string; current: string; reference: string; status: DerivedStatus }[];
  limitations: string[];
} {
  const summary = deriveAccountObjectiveSummary(facts);
  const limitations: string[] = [];
  const metrics: { name: string; current: string; reference: string; status: DerivedStatus }[] =
    [];

  if (summary.mixed_funnel) {
    limitations.push(
      "Conta com múltiplos objetivos de campanha (funil completo). ROAS e CPA abaixo referem-se apenas a campanhas de Vendas.",
    );
  }

  const sb = summary.sales_block;
  if (sb && sb.roas != null) {
    const sRoas: DerivedStatus =
      sb.roas >= 3 ? "bom" : sb.roas >= 1.5 ? "atenção" : "alerta";
    metrics.push({
      name: "ROAS (Vendas)",
      current: fmtX(sb.roas),
      reference: "> 3x",
      status: sRoas,
    });
    if (sb.cpa != null) {
      metrics.push({
        name: "Custo por compra (Vendas)",
        current: fmtBRL(sb.cpa),
        reference: "varia por margem",
        status: "sem dados",
      });
    }
  } else {
    metrics.push({
      name: "ROAS (Vendas)",
      current: "sem tracking",
      reference: "> 3x",
      status: "sem tracking",
    });
    limitations.push(
      "Sem campanhas de Vendas com compras rastreadas no período — ROAS de compra não calculado.",
    );
  }

  const ins = (facts?.account_insights ?? {}) as Record<string, unknown>;
  const ctr = num(ins.ctr);
  const cpm = num(ins.cpm);
  const frequency = num(ins.frequency);
  const account_context_metrics = [
    {
      name: "CTR (conta)",
      current: ctr != null ? fmtPct(ctr) : "—",
      reference: "média de todas as campanhas",
      status: (ctr == null
        ? "sem dados"
        : ctr >= 1.2
          ? "bom"
          : ctr >= 0.8
            ? "atenção"
            : "alerta") as DerivedStatus,
    },
    {
      name: "CPM (conta)",
      current: cpm != null ? fmtBRL(cpm) : "—",
      reference: "contexto geral",
      status: (cpm == null
        ? "sem dados"
        : cpm <= 25
          ? "bom"
          : cpm <= 40
            ? "atenção"
            : "alerta") as DerivedStatus,
    },
    {
      name: "Frequência (conta)",
      current: fmtNum(frequency),
      reference: "< 3,5",
      status: (frequency == null
        ? "sem dados"
        : frequency <= 3.5
          ? "bom"
          : frequency <= 5
            ? "atenção"
            : "alerta") as DerivedStatus,
    },
  ];

  return { metrics, account_context_metrics, limitations };
}


function findActionValue(arr: unknown, regex: RegExp): number | null {
  if (!Array.isArray(arr)) return null;
  const hit = arr.find((a) => {
    const o = a as Record<string, unknown>;
    return typeof o?.action_type === "string" && regex.test(o.action_type);
  }) as Record<string, unknown> | undefined;
  return hit ? num(hit.value) : null;
}

export function deriveBestWorstAdsV2(
  facts: Record<string, unknown> | null | undefined,
): { best: string | null; worst: string | null } {
  const list = Array.isArray(facts?.ads_insights_top)
    ? (facts!.ads_insights_top as Record<string, unknown>[])
    : [];
  if (list.length === 0) return { best: null, worst: null };

  const enriched = getEnriched(facts);
  const familyByCampaignName = new Map<string, ObjectiveFamily>();
  for (const c of enriched) {
    familyByCampaignName.set(c.name, c.family);
  }

  const totalSpend = list.reduce((s, a) => s + (num(a.spend) ?? 0), 0);
  // Lower threshold so high-ROAS but low-spend winners are not excluded
  const minSpend = Math.max(30, totalSpend * 0.01);

  type Scored = {
    name: string;
    campaign: string;
    spend: number;
    family: ObjectiveFamily;
    roas: number | null;
    ctr: number | null;
    score: number;
  };

  const scored: Scored[] = list.map((a) => {
    const spend = num(a.spend) ?? 0;
    const campaign = String(a.campaign_name ?? "");
    const family = familyByCampaignName.get(campaign) ?? "other";
    const roas = computeRoas(a.action_values, spend);
    const ctr = num(a.ctr);
    let score = 0;
    if (family === "sales" && roas != null) score = roas;
    else if (ctr != null) score = ctr;
    else score = spend > 0 ? 0 : -1;
    return {
      name: String(a.ad_name ?? a.ad_id ?? "anúncio"),
      campaign,
      spend,
      family,
      roas,
      ctr,
      score,
    };
  });

  const eligible = scored.filter((a) => a.spend >= minSpend && a.score >= 0);
  const pool = eligible.length >= 2 ? eligible : scored.filter((a) => a.score >= 0);
  if (pool.length < 2) return { best: null, worst: null };

  const sorted = [...pool].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const fmt = (a: Scored) => {
    const parts = [a.name];
    if (a.campaign) parts.push(`(${a.campaign})`);
    const metr: string[] = [];
    if (a.family === "sales" && a.roas != null) metr.push(`ROAS ${fmtX(a.roas)}`);
    else if (a.ctr != null) metr.push(`CTR ${fmtPct(a.ctr)}`);
    metr.push(`gasto ${fmtBRL(a.spend)}`);
    return `${parts.join(" ")} — ${metr.join(" · ")}`;
  };

  return { best: fmt(best), worst: fmt(worst) };
}

export function buildFactsEnrichment(
  campaigns_sample: Record<string, unknown>[],
  campaigns_insights: Record<string, unknown>[],
): {
  campaigns_enriched: CampaignEnriched[];
  objective_spend_mix: Record<string, number>;
} {
  const campaigns_enriched = enrichCampaigns(campaigns_sample, campaigns_insights);
  const objective_spend_mix = computeSpendMix(campaigns_enriched);
  return { campaigns_enriched, objective_spend_mix };
}

/** Orientação injetada no prompt da IA — evita falso positivo de sobreposição e ROAS em não-Vendas. */
export type FunnelGuidanceForAi = {
  mixed_funnel: boolean;
  objective_families_present: string[];
  campaign_count: number;
  overlap_between_objectives_is_normal: boolean;
  mandatory_rules_pt: string[];
};

export function deriveFunnelGuidanceForAi(
  facts: Record<string, unknown> | null | undefined,
): FunnelGuidanceForAi {
  const summary = deriveAccountObjectiveSummary(facts);
  const enriched = getEnriched(facts);
  const families = summary.by_family.map((f) => f.label);
  const rules: string[] = [];

  rules.push(
    "Fonte de verdade do objetivo: campaigns_enriched[].objective_raw e family_label_pt — NUNCA o nome da campanha ([GM], Geo, Meio, etc.).",
  );
  rules.push(
    "ROAS, receita e compras aplicam-se SOMENTE a campanhas family=sales com pixel de compra. Demais famílias: avaliar primary_result.label_pt, count e cost_per_result.",
  );
  rules.push(
    "PROIBIDO criticalIssue, budgetLeak ou actionPlan que critique 'falta de vendas/ROAS' em campanha cujo family não seja sales.",
  );
  rules.push(
    "budgetLeaks por ROAS baixo: apenas campanhas de Vendas com roas numérico em campaigns_enriched; nunca awareness/traffic/leads.",
  );

  if (summary.mixed_funnel) {
    rules.push(
      `FUNIL MISTO DETECTADO (${families.join(" + ")}): várias campanhas com objetivos Meta DIFERENTES coexistindo é estratégia normal de funil — NÃO é sobreposição de público nem canibalização.`,
    );
    rules.push(
      "PROIBIDO afirmar 'sobreposição de públicos', 'canibalização' ou '% de overlap' só porque existem 2+ campanhas ativas, nomes parecidos ou gasto dividido entre Geo/Meio/Conversão.",
    );
    rules.push(
      "Sobre sobreposição: só se reach/impressions < 50% ou frequência ≥ 5 na MESMA campanha/conjunto, ou saved_audience_id/targeting idêntico comprovado — nunca 'entre campanhas de objetivos diferentes'.",
    );
    rules.push(
      "audiencesSummary: descreva o mix por objetivo (ex.: % em Reconhecimento vs Vendas); se não houver targeting granular, limite-se a dataLimitations — sem alarme de overlap.",
    );
    rules.push(
      "Pontos fortes em executiveSummary podem incluir funil completo (topo + meio + fundo) quando as campanhas não-sales tiverem kpi_status bom ou atenção aceitável.",
    );
  } else {
    rules.push(
      "Conta com um único tipo de objetivo dominante — ainda assim, sobreposição exige evidência numérica; não inferir só por múltiplos conjuntos.",
    );
  }

  return {
    mixed_funnel: summary.mixed_funnel,
    objective_families_present: families,
    campaign_count: enriched.length,
    overlap_between_objectives_is_normal: summary.mixed_funnel,
    mandatory_rules_pt: rules,
  };
}

export function normalizeAnalysisV2(
  obj: Record<string, unknown>,
  facts?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!Array.isArray(obj.dataLimitations)) obj.dataLimitations = [];
  if (!Array.isArray(obj.budgetLeaks)) obj.budgetLeaks = [];
  if (!Array.isArray(obj.opportunities)) obj.opportunities = [];
  if (!Array.isArray(obj.structureNotes)) obj.structureNotes = [];
  if (!Array.isArray(obj.actionPlan)) obj.actionPlan = [];

  const derived = deriveMetricsFromFactsV2(facts ?? null);
  obj.metrics = derived.metrics;
  obj.accountContextMetrics = derived.account_context_metrics;
  for (const lim of derived.limitations) {
    if (!(obj.dataLimitations as string[]).includes(lim)) {
      (obj.dataLimitations as string[]).push(lim);
    }
  }

  const cb = deriveCampaignBreakdownV2(facts ?? null);
  obj.campaignBreakdown = cb.rows;
  if (cb.rows.length === 0) {
    (obj.dataLimitations as string[]).push(
      "Breakdown por campanha indisponível: a Meta não retornou insights ao nível de campanha para o período.",
    );
  }

  obj.accountObjectiveSummary = deriveAccountObjectiveSummary(facts ?? null);

  const scoreDerived = deriveScoreV2(facts ?? null);
  obj.score = scoreDerived.score;
  obj.scoreLabel = scoreDerived.scoreLabel;

  const bw = deriveBestWorstAdsV2(facts ?? null);
  const prevCreatives = (obj.creativesSummary as Record<string, unknown> | undefined) ?? {};
  obj.creativesSummary = {
    best: bw.best ?? (prevCreatives.best as string | null) ?? null,
    worst: bw.worst ?? (prevCreatives.worst as string | null) ?? null,
    recommendation:
      (prevCreatives.recommendation as string | undefined) ??
      "Concentrar verba nos criativos com melhor desempenho no objetivo de cada campanha (ROAS em Vendas, CTR/CPC em Tráfego).",
  };
  if (!bw.best && !bw.worst) {
    (obj.dataLimitations as string[]).push(
      "Análise de criativos limitada: insights ao nível de anúncio não disponíveis ou insuficientes no período.",
    );
  }

  if (!obj.audiencesSummary || typeof obj.audiencesSummary !== "object") {
    obj.audiencesSummary = {
      segmentation: "Dados insuficientes para análise de públicos.",
      notes: [],
    };
    (obj.dataLimitations as string[]).push(
      "Detalhamento de públicos por ad set não disponível.",
    );
  }

  if (!obj.improvementScenario || typeof obj.improvementScenario !== "object") {
    obj.improvementScenario = {
      note: "Cenário de melhoria não calculado por dados insuficientes.",
      confidence: "low",
    };
  }

  const commercial = buildCommercialDerived(facts ?? null);
  commercial.seniorDerived = buildSeniorDerived(
    facts ?? null,
    commercial,
    scoreDerived.score,
  );
  applyBusinessHintsToSenior(commercial.seniorDerived, facts ?? null);

  const metaSenior = facts?.meta_senior;
  if (metaSenior && typeof metaSenior === "object") {
    obj.metaSenior = metaSenior;
  }

  const consultative = facts?.consultative_derived;
  if (consultative && typeof consultative === "object") {
    obj.consultativeDerived = consultative;
  }

  if (facts && typeof facts === "object") {
    buildGrowthIntelligenceDerived(facts as Record<string, unknown>, commercial);
  }
  const growthIntel = facts?.growth_intelligence_derived;
  if (growthIntel && typeof growthIntel === "object") {
    obj.growthIntelligenceDerived = growthIntel;
  }
  Object.assign(obj, commercialToAnalysisFields(commercial));

  const seeds =
    (Array.isArray(facts?.hypothesis_seeds)
      ? (facts!.hypothesis_seeds as ReturnType<typeof deriveHypothesisSeeds>)
      : null) ??
    deriveHypothesisSeeds(facts ?? null, commercial.seniorDerived!, commercial);
  obj.hypothesisSeeds = seeds;

  const rawPlan = obj.actionPlan as Record<string, unknown>[];
  const prioritized = deriveActionPriority(
    commercial.seniorDerived!,
    rawPlan as Parameters<typeof deriveActionPriority>[1],
    seeds,
  );
  obj.actionPlan = prioritized;
  obj.prioritizedActions = prioritized;
  obj.mondayActions = topActionsNow(prioritized);

  const limitations = obj.dataLimitations as string[];
  obj.criticalIssues = sanitizeCriticalIssuesV13(
    obj.criticalIssues as Record<string, unknown>[],
    limitations,
  );
  enrichCriticalIssuesWithHypothesis(
    obj.criticalIssues as Record<string, unknown>[],
    seeds,
  );

  if (typeof obj.narrativeHook !== "string" || !String(obj.narrativeHook).trim()) {
    obj.narrativeHook = commercial.storyExecutive.headline;
  }
  if (typeof obj.verdictLine !== "string" || !String(obj.verdictLine).trim()) {
    const first = commercial.topFindings[0];
    obj.verdictLine = first
      ? `${first.headline}. ${commercial.financialBalance.netPositionLabel}`.slice(0, 220)
      : commercial.storyExecutive.headline.slice(0, 220);
  }
  if (!obj.executiveSummary || typeof obj.executiveSummary !== "object") {
    obj.executiveSummary = {
      strengths: [],
      risks: [],
      oneLiner: commercial.recovery.basisNote,
    };
  }
  if (!Array.isArray(obj.criticalIssues)) obj.criticalIssues = [];
  const issues = obj.criticalIssues as Record<string, unknown>[];
  for (const issue of issues) {
    if (typeof issue.cause !== "string" || !issue.cause.trim()) {
      issue.cause =
        "Combinação de configuração da campanha, objetivo declarado na Meta e desempenho observado no período.";
    }
    if (typeof issue.consequence !== "string" || !issue.consequence.trim()) {
      issue.consequence =
        "Reduz previsibilidade de resultado e pode elevar custo por venda ou desperdiçar verba em funil incorreto.";
    }
  }
  if (!obj.improvementScenario || typeof obj.improvementScenario !== "object") {
    obj.improvementScenario = {
      note: commercial.recovery.basisNote,
      confidence: commercial.recovery.confidence,
    };
  } else {
    const prev = obj.improvementScenario as Record<string, unknown>;
    if (!prev.note || String(prev.note).includes("insuficientes")) {
      prev.note = commercial.recovery.basisNote;
    }
    if (!prev.confidence) prev.confidence = commercial.recovery.confidence;
  }

  if (!obj.executiveConclusion || typeof obj.executiveConclusion !== "object") {
    const gi = growthIntel as Record<string, unknown> | undefined;
    const impact = gi?.executiveImpact as Record<string, unknown> | undefined;
    const leaks = Array.isArray(gi?.moneyLeaks)
      ? (gi!.moneyLeaks as { monthlyImpactBrl?: number }[])
      : [];
    const leakSum = leaks.reduce((s, l) => s + (l.monthlyImpactBrl ?? 0), 0);
    const gap = typeof impact?.gapMonthlyBrl === "number" ? impact.gapMonthlyBrl : 0;
    const recover = commercial.recovery.conservativeMonthlyBrl;
    const firstAction = Array.isArray(gi?.decisionActions)
      ? String((gi!.decisionActions as { action?: string }[])[0]?.action ?? "")
      : String(prioritized[0]?.action ?? "");
    const funnel = (consultative as { conversionFunnel?: { bottleneck?: string } } | undefined)
      ?.conversionFunnel;
    obj.executiveConclusion = {
      isHealthy: gap < 500 && leakSum < 800 && scoreDerived.score >= 70,
      primaryProblemDomain:
        funnel?.bottleneck === "checkout" ? "structure" : leakSum > 0 ? "meta" : "mixed",
      moneyLostMonthlyBrl: leakSum > 0 ? leakSum : gap > 0 ? gap : null,
      recoverableMonthlyBrl: recover > 0 ? recover : null,
      generatableMonthlyBrl:
        typeof impact?.gapMonthlyBrl === "number" && impact.gapMonthlyBrl > 0
          ? impact.gapMonthlyBrl
          : null,
      scaleNow:
        scoreDerived.score >= 75 && gap < 1000 ? "yes" : gap > 3000 ? "no" : "conditional",
      firstDecisionIfIHired:
        firstAction || commercial.storyExecutive.headline.slice(0, 200),
    };
  }

  return obj;
}

function applyBusinessHintsToSenior(
  senior: SeniorDerived,
  facts: Record<string, unknown> | null,
): void {
  const ctx = facts?.business_context as BusinessContextInput | undefined;
  const hints = deriveBusinessHints(ctx);
  if (hints) {
    facts!.business_hints = hints;
    if (hints.marginNote) {
      senior.diagnostics.financial.impactNote = hints.marginNote;
    }
  }
}

function sanitizeCriticalIssuesV13(
  issues: Record<string, unknown>[],
  limitations: string[],
): Record<string, unknown>[] {
  const kept: Record<string, unknown>[] = [];
  for (const issue of issues) {
    if (String(issue.confidence ?? "") === "needs_data") {
      const title = String(issue.title ?? "problema identificado").slice(0, 120);
      const note = `Dados insuficientes para conclusão definitiva: ${title}`;
      if (!limitations.includes(note)) limitations.push(note);
      continue;
    }
    const priority = String(issue.priority ?? "medium");
    if (
      (priority === "high" || priority === "medium") &&
      !issue.hypothesisId
    ) {
      console.warn(
        `[normalizeAnalysisV2] criticalIssue high/medium sem hypothesisId: ${String(issue.title ?? "").slice(0, 80)}`,
      );
    }
    kept.push(issue);
  }
  return kept;
}

function enrichCriticalIssuesWithHypothesis(
  issues: Record<string, unknown>[],
  seeds: ReturnType<typeof deriveHypothesisSeeds>,
): void {
  for (const issue of issues) {
    const priority = String(issue.priority ?? "medium");
    if (priority === "low") continue;
    if (issue.hypothesisId && issue.confidence) continue;
    const axis = issue.axis ? String(issue.axis) : null;
    const match =
      seeds.find((s) => s.axis === axis && s.confidence !== "needs_data") ??
      seeds.find((s) => s.confidence === "high") ??
      seeds[0];
    if (!match) continue;
    if (!issue.hypothesisId) issue.hypothesisId = match.id;
    if (!issue.confidence) issue.confidence = match.confidence;
    if (!Array.isArray(issue.evidenceFor) || !(issue.evidenceFor as unknown[]).length) {
      issue.evidenceFor = [...match.evidenceFor];
    }
    if (
      !Array.isArray(issue.evidenceAgainst) ||
      !(issue.evidenceAgainst as unknown[]).length
    ) {
      issue.evidenceAgainst = [...match.evidenceAgainst];
    }
    if (!issue.conclusion) {
      issue.conclusion = match.claim;
    }
  }
}

// ── Funil de Conversão ────────────────────────────────────────────────────────

const LPV_PATTERNS = [/^landing_page_view$/i];
const ATC_PATTERNS = [
  /^add_to_cart$/i,
  /offsite_conversion\.fb_pixel_add_to_cart/i,
  /fb_pixel_add_to_cart/i,
];
const CHECKOUT_PATTERNS = [
  /^initiate_checkout$/i,
  /offsite_conversion\.fb_pixel_initiate_checkout/i,
  /fb_pixel_initiate_checkout/i,
];
const PURCHASE_PATTERNS = [
  /^purchase$/i,
  /^omni_purchase$/i,
  /offsite_conversion\.fb_pixel_purchase/i,
];

function extractFunnelActionCount(actions: unknown, patterns: RegExp[]): number {
  if (!Array.isArray(actions)) return 0;
  let total = 0;
  for (const a of actions as Record<string, unknown>[]) {
    const t = String(a.action_type ?? "");
    if (patterns.some((p) => p.test(t))) {
      total += num(a.value) ?? 0;
    }
  }
  return total;
}

export type ConversionFunnel = {
  lpv: number;
  atc: number;
  checkout: number;
  purchase: number;
  atcRate: number | null;
  checkoutRate: number | null;
  purchaseRate: number | null;
  bottleneck: "lpv" | "atc" | "checkout" | "none" | "insufficient_data";
  bottleneckLabel: string;
  revenueAtRiskMonthlyBrl: number | null;
};

export function deriveFunnelAnalysis(
  facts: Record<string, unknown> | null | undefined,
): ConversionFunnel | null {
  const campaignInsights = Array.isArray(facts?.campaigns_insights)
    ? (facts!.campaigns_insights as Record<string, unknown>[])
    : [];
  const enriched = getEnriched(facts);
  const salesIds = new Set(
    enriched.filter((c) => c.family === "sales").map((c) => c.campaign_id),
  );
  if (salesIds.size === 0) return null;

  let lpv = 0, atc = 0, checkout = 0, purchase = 0;
  for (const ci of campaignInsights) {
    if (!salesIds.has(String(ci.campaign_id ?? ""))) continue;
    const actions = ci.actions;
    lpv += extractFunnelActionCount(actions, LPV_PATTERNS);
    atc += extractFunnelActionCount(actions, ATC_PATTERNS);
    checkout += extractFunnelActionCount(actions, CHECKOUT_PATTERNS);
    purchase += extractFunnelActionCount(actions, PURCHASE_PATTERNS);
  }

  if (purchase === 0 && checkout === 0) return null;

  const bizCtx = facts?.business_context as BusinessContextInput | undefined;
  const niche = resolveNicheContext(facts ?? null, bizCtx ?? null);
  const checkoutRefPct = referenciaIdeal(niche.nicheKey, "taxa_checkout_compra") ?? 55;

  const atcRate = lpv > 0 && atc > 0 ? (atc / lpv) * 100 : null;
  const checkoutRate = atc > 0 && checkout > 0 ? (checkout / atc) * 100 : null;
  const purchaseRate = checkout > 0 && purchase > 0 ? (purchase / checkout) * 100 : null;

  let bottleneck: ConversionFunnel["bottleneck"] = "none";
  let bottleneckLabel = "Funil sem gargalo identificado no período.";

  if (purchaseRate != null && purchaseRate < 35 && checkout >= 10) {
    bottleneck = "checkout";
    bottleneckLabel = `Alta taxa de abandono no checkout: ${purchaseRate.toFixed(0)}% finalizam (referência saudável: ${checkoutRefPct}% em ${niche.nicheLabel}).`;
  } else if (checkoutRate != null && checkoutRate < 20 && atc >= 20) {
    bottleneck = "atc";
    bottleneckLabel = `Alta taxa de abandono de carrinho: ${checkoutRate.toFixed(0)}% avançam ao checkout.`;
  } else if (atcRate != null && atcRate < 3 && lpv >= 100) {
    bottleneck = "lpv";
    bottleneckLabel = `Taxa de ATC baixa: ${atcRate.toFixed(1)}% dos visitantes adicionam ao carrinho.`;
  } else if (purchase > 0 && checkout === 0 && atc === 0 && lpv === 0) {
    bottleneck = "insufficient_data";
    bottleneckLabel = "Dados insuficientes para análise completa do funil (apenas compras rastreadas).";
  }

  let revenueAtRiskMonthlyBrl: number | null = null;
  if (bottleneck === "checkout" && purchase > 0 && checkout > 0) {
    let ticket = bizCtx?.avg_ticket_brl ?? null;
    if (ticket == null) {
      let totalRevenue = 0;
      for (const c of enriched) {
        if (c.family === "sales" && c.roas != null) totalRevenue += c.roas * c.spend;
      }
      if (totalRevenue > 0) ticket = totalRevenue / purchase;
    }
    ticket = ticket ?? ticketMedioReferencia(niche.nicheKey) ?? 200;
    const impact = calcularImpactoCheckout({
      checkouts: checkout,
      comprasReais: purchase,
      taxaReferenciaPct: checkoutRefPct,
      ticketMedioBrl: ticket,
    });
    if (impact.receitaPerdidaEstimada >= 50) {
      revenueAtRiskMonthlyBrl = impact.receitaPerdidaEstimada;
    }
  }

  return { lpv, atc, checkout, purchase, atcRate, checkoutRate, purchaseRate, bottleneck, bottleneckLabel, revenueAtRiskMonthlyBrl };
}

// ── Learning Status dos Ad Sets ───────────────────────────────────────────────

export type AdsetLearningStatus = {
  adset_id: string;
  adset_name: string;
  learning_status: "learning" | "learning_fail" | "active" | "off" | "unknown";
  learning_limited_reason: "budget" | "audience" | "conversion_window" | "low_bid" | null;
  days_in_learning: number | null;
  has_issues: boolean;
  issues_summary: string[];
  delivery_substatus_pt?: string;
};

function classifyLearningStage(
  learningStageInfo: Record<string, unknown> | null | undefined,
  issuesInfo: Record<string, unknown>[] | null | undefined,
): Pick<AdsetLearningStatus, "learning_status" | "learning_limited_reason" | "days_in_learning"> {
  if (!learningStageInfo) return { learning_status: "unknown", learning_limited_reason: null, days_in_learning: null };
  const raw = String(learningStageInfo.status ?? "").toUpperCase();
  const days = num(learningStageInfo.days_in_learning_phase);
  if (raw === "LEARNING") return { learning_status: "learning", learning_limited_reason: null, days_in_learning: days };
  if (raw === "EXITED") return { learning_status: "active", learning_limited_reason: null, days_in_learning: days };
  if (raw === "OFF") return { learning_status: "off", learning_limited_reason: null, days_in_learning: days };
  if (raw === "LEARNING_LIMITED") {
    const summaries = (issuesInfo ?? []).map((i) => String(i.error_summary ?? "").toLowerCase());
    let reason: AdsetLearningStatus["learning_limited_reason"] = null;
    if (summaries.some((s) => s.includes("budget"))) reason = "budget";
    else if (summaries.some((s) => s.includes("audience") || s.includes("narrow"))) reason = "audience";
    else if (summaries.some((s) => s.includes("attribution") || s.includes("window"))) reason = "conversion_window";
    else if (summaries.some((s) => s.includes("bid") || s.includes("cost cap"))) reason = "low_bid";
    return { learning_status: "learning_fail", learning_limited_reason: reason, days_in_learning: days };
  }
  return { learning_status: "unknown", learning_limited_reason: null, days_in_learning: null };
}

export function deriveAdsetLearningStatus(
  facts: Record<string, unknown> | null | undefined,
): AdsetLearningStatus[] {
  const config = Array.isArray(facts?.adsets_config)
    ? (facts!.adsets_config as Record<string, unknown>[])
    : [];
  const result: AdsetLearningStatus[] = [];
  for (const a of config) {
    const adset_id = String(a.id ?? "");
    if (!adset_id) continue;
    const learningStage = (a.learning_stage_info as Record<string, unknown> | undefined) ?? null;
    const issuesArr = Array.isArray(a.issues_info)
      ? (a.issues_info as Record<string, unknown>[])
      : null;
    const { learning_status, learning_limited_reason, days_in_learning } = classifyLearningStage(learningStage, issuesArr);
    result.push({
      adset_id,
      adset_name: String(a.name ?? ""),
      learning_status,
      learning_limited_reason,
      days_in_learning,
      has_issues: (issuesArr?.length ?? 0) > 0,
      issues_summary: issuesArr ? issuesArr.map((i) => String(i.error_summary ?? "")).filter(Boolean) : [],
    });
  }
  return result;
}

// ── Winner Sub-Investido ──────────────────────────────────────────────────────

export type WinnerUnderinvested = {
  adId: string;
  adName: string;
  roas: number;
  spend: number;
  campaignName: string;
  campaignRoas: number | null;
  spendPct: number;
  spendNote: string;
};

export function deriveWinnerUnderinvested(
  facts: Record<string, unknown> | null | undefined,
): WinnerUnderinvested | null {
  const ads = Array.isArray(facts?.ads_insights_top)
    ? (facts!.ads_insights_top as Record<string, unknown>[])
    : [];
  if (ads.length < 2) return null;

  const enriched = getEnriched(facts);
  const salesByCampaignName = new Map<string, CampaignEnriched>();
  for (const c of enriched) {
    if (c.family === "sales") salesByCampaignName.set(c.name, c);
  }

  type ScoredAd = {
    adId: string; adName: string; spend: number;
    roas: number; campaignName: string;
    campaignRoas: number | null; campaignSpend: number;
  };

  const salesAds: ScoredAd[] = [];
  for (const a of ads) {
    const spend = num(a.spend) ?? 0;
    if (spend < 30) continue;
    const roas = computeRoas(a.action_values, spend);
    if (roas == null || roas <= 0) continue;
    const campaignName = String(a.campaign_name ?? "");
    const campaign = salesByCampaignName.get(campaignName);
    if (!campaign) continue;
    salesAds.push({ adId: String(a.ad_id ?? ""), adName: String(a.ad_name ?? ""), spend, roas, campaignName, campaignRoas: campaign.roas, campaignSpend: campaign.spend });
  }

  if (salesAds.length < 2) return null;

  const sorted = [...salesAds].sort((a, b) => b.roas - a.roas);
  const best = sorted[0];
  const spendPct = best.campaignSpend > 0 ? Math.round((best.spend / best.campaignSpend) * 1000) / 10 : 0;
  const campaignRoas = best.campaignRoas ?? 0;
  const isOutlierRoas = campaignRoas > 0 ? best.roas >= campaignRoas * 2.5 : best.roas >= 5;
  if (!isOutlierRoas || spendPct >= 20) return null;

  return {
    adId: best.adId,
    adName: best.adName.slice(0, 80),
    roas: Math.round(best.roas * 100) / 100,
    spend: best.spend,
    campaignName: best.campaignName,
    campaignRoas: best.campaignRoas,
    spendPct,
    spendNote: `R$${best.spend.toFixed(0)} (${spendPct}% do budget da campanha)`,
  };
}

export function mergeBusinessContextIntoFacts(
  facts: Record<string, unknown>,
  businessContext: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!businessContext || typeof businessContext !== "object") return facts;
  facts.business_context = businessContext;
  return facts;
}

export function attachCommercialToFacts(
  facts: Record<string, unknown>,
): Record<string, unknown> {
  attachMetaSeniorToFacts(facts);
  facts.funnel_guidance = deriveFunnelGuidanceForAi(facts);

  const bizCtx = facts.business_context as Record<string, unknown> | undefined;
  buildConsultativeDerived(facts, bizCtx);

  const funnel = deriveFunnelAnalysis(facts);
  if (funnel) facts.conversion_funnel = funnel;

  const winner = deriveWinnerUnderinvested(facts);
  if (winner) facts.adset_winner_underinvested = winner;

  const commercial = buildCommercialDerived(facts);
  const scoreDerived = deriveScoreV2(facts);
  commercial.seniorDerived = buildSeniorDerived(facts, commercial, scoreDerived.score);
  applyBusinessHintsToSenior(commercial.seniorDerived, facts);
  const seeds = deriveHypothesisSeeds(facts, commercial.seniorDerived, commercial);
  facts.hypothesis_seeds = seeds;
  facts.commercial_derived = commercial;
  facts.senior_derived = commercial.seniorDerived;

  buildGrowthIntelligenceDerived(facts, commercial);

  return facts;
}
