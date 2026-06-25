import { buildCommercialDerived } from "./derive-commercial.ts";
import { deriveFunnelGuidanceForAi } from "./derive-analysis.ts";
import { num } from "./campaign-objective.ts";

function sliceJson(value: unknown, max: number): string {
  if (value == null) return "(indisponível)";
  return JSON.stringify(value).slice(0, max);
}

/** Subconjunto mínimo de facts para contexto sem duplicar motores derivados. */
export function buildFactsCompact(facts: Record<string, unknown>): Record<string, unknown> {
  const guidance = facts.funnel_guidance ?? deriveFunnelGuidanceForAi(facts);
  const enriched = Array.isArray(facts.campaigns_enriched)
    ? (facts.campaigns_enriched as Record<string, unknown>[]).slice(0, 5)
    : [];
  const account = facts.account_insights as Record<string, unknown> | undefined;
  const funnel = facts.conversion_funnel as Record<string, unknown> | undefined;
  return {
    spend_30d: account?.spend ?? null,
    currency: account?.account_currency ?? "BRL",
    objective_spend_mix: facts.objective_spend_mix ?? null,
    mixed_funnel: (guidance as { mixed_funnel?: boolean }).mixed_funnel ?? false,
    overlap_between_objectives_is_normal:
      (guidance as { overlap_between_objectives_is_normal?: boolean })
        .overlap_between_objectives_is_normal ?? false,
    campaigns_enriched_top5: enriched,
    conversion_funnel_bottleneck: funnel?.bottleneck ?? null,
    date_preset: facts.date_preset ?? "last_30d",
  };
}

export function buildUserPromptSlim(facts: Record<string, unknown>): string {
  const guidance =
    facts.funnel_guidance ?? deriveFunnelGuidanceForAi(facts);
  const commercial =
    facts.commercial_derived ?? buildCommercialDerived(facts);
  const compact = {
    top_findings: commercial.topFindings,
    financial_balance: commercial.financialBalance,
    story_executive: commercial.storyExecutive,
    waste: commercial.waste,
    recovery: commercial.recovery,
  };
  const growthIntel = facts.growth_intelligence_derived;
  const growthSlice = growthIntel
    ? {
        executiveImpact: (growthIntel as { executiveImpact?: unknown }).executiveImpact,
        moneyLeaks: (growthIntel as { moneyLeaks?: unknown }).moneyLeaks,
        growthOpportunities: (growthIntel as { growthOpportunities?: unknown })
          .growthOpportunities,
        risks: (growthIntel as { risks?: unknown }).risks,
        benchmarkImpacts: (growthIntel as { benchmarkImpacts?: unknown }).benchmarkImpacts,
        maturity: (growthIntel as { maturity?: unknown }).maturity,
        decisionActions: (growthIntel as { decisionActions?: unknown }).decisionActions,
        projections: (growthIntel as { projections?: unknown }).projections,
        accountHealth: (growthIntel as { accountHealth?: unknown }).accountHealth,
        accountTrend: (growthIntel as { accountTrend?: unknown }).accountTrend,
      }
    : null;
  const consultative = facts.consultative_derived;
  const consultSlice = consultative
    ? {
        accountFinancialGap: (consultative as { accountFinancialGap?: unknown })
          .accountFinancialGap,
        deliverySummary: (consultative as { deliverySummary?: unknown }).deliverySummary,
        conversionFunnel: (consultative as { conversionFunnel?: unknown }).conversionFunnel,
        adsetBleedRanking: (consultative as { adsetBleedRanking?: unknown }).adsetBleedRanking,
        winnerUnderinvested: (consultative as { winnerUnderinvested?: unknown })
          .winnerUnderinvested,
        adVideoDiagnostics: (consultative as { adVideoDiagnostics?: unknown })
          .adVideoDiagnostics,
      }
    : {
        accountFinancialGap: facts.account_financial_gap,
        conversionFunnel: facts.conversion_funnel,
        adsetLearningStatus: facts.adset_learning_status,
        winnerUnderinvested: facts.adset_winner_underinvested,
      };
  const metaSenior = facts.meta_senior;
  const includeMetaSenior =
    metaSenior &&
    !growthSlice?.moneyLeaks;
  const metaSlice = includeMetaSenior
    ? {
        opportunityScore: (metaSenior as { opportunityScore?: unknown }).opportunityScore,
        auctionDiagnostics: (metaSenior as { auctionDiagnostics?: unknown }).auctionDiagnostics,
        funnelHealth: (metaSenior as { funnelHealth?: unknown }).funnelHealth,
      }
    : null;
  const seeds = facts.hypothesis_seeds;
  const bizCtx = facts.business_context;
  const bizHints = facts.business_hints;
  const factsCompact = buildFactsCompact(facts);

  return [
    "growth_intelligence_derived (fonte única R$ e maturidade — não invente):",
    sliceJson(growthSlice, 12000),
    "",
    "consultative_derived (Páprika — funil, bleed, winner):",
    sliceJson(consultSlice, 10000),
    "",
    "funnel_guidance (obrigatório — funil misto NÃO é overlap):",
    sliceJson(guidance, 4000),
    "",
    "business_context:",
    sliceJson(bizCtx, 2000),
    "",
    "business_hints:",
    sliceJson(bizHints, 1500),
    "",
    "hypothesis_seeds:",
    sliceJson(seeds, 8000),
    "",
    "meta_senior (só se growth indisponível):",
    sliceJson(metaSlice, 8000),
    "",
    "commercial_derived (R$ — não altere valores):",
    sliceJson(compact, 8000),
    "",
    "facts_compact (contexto mínimo — detalhes nos blocos acima):",
    sliceJson(factsCompact, 4000),
  ].join("\n");
}

export function parseAccountSpendBrl(
  accountInsights: Record<string, unknown> | undefined,
): number {
  return num(accountInsights?.spend) ?? 0;
}

export function isSmallAccountSpend(spendBrl: number): boolean {
  const threshold = Math.max(
    0,
    Number(Deno.env.get("DIAGNOSIS_SMALL_ACCOUNT_SPEND_BRL") ?? "3000") || 3000,
  );
  return spendBrl < threshold;
}
