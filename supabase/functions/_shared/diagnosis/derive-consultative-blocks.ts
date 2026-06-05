import {
  deriveAccountFinancialGap,
  type AccountFinancialGap,
} from "./derive-account-financial-gap.ts";
import {
  deriveAdsetLearningStatus,
  deriveFunnelAnalysis,
  deriveWinnerUnderinvested,
  type ConversionFunnel,
} from "./derive-analysis.ts";
import { deriveAdsetBleedRanking, type AdsetBleedRow } from "./derive-adset-bleed.ts";
import {
  deriveDeliverySummary,
  enrichLearningWithSubstatus,
  type DeliverySummary,
} from "./derive-delivery-summary.ts";
import { resolveNicheContext, type NicheContext } from "./derive-niche-context.ts";
import {
  deriveAdVideoDiagnostics,
  type AdVideoDiagnostic,
} from "./derive-ad-video-retention.ts";
import type { WinnerUnderinvested } from "./derive-analysis.ts";

export type ConsultativeQaChecklist = {
  hasBrlPerProblem: boolean;
  hasNamedEntities: boolean;
  awarenessNotJudgedByRoas: boolean;
  learningReadBeforeRoas: boolean;
  funnelBuiltWhenSales: boolean;
  bestCreativeNamed: boolean;
  nicheBenchmarkApplied: boolean;
  plainLanguage: boolean;
  opensWithFinancialGap: boolean;
  hasSurpriseInsight: boolean;
};

export type ConsultativeDerived = {
  nicheContext: NicheContext;
  accountFinancialGap: AccountFinancialGap | null;
  deliverySummary: DeliverySummary | null;
  conversionFunnel: ConversionFunnel | null;
  adsetLearningStatus: ReturnType<typeof enrichLearningWithSubstatus>;
  adsetBleedRanking: AdsetBleedRow[];
  winnerUnderinvested: WinnerUnderinvested | null;
  adVideoDiagnostics: AdVideoDiagnostic[];
  qaChecklist: ConsultativeQaChecklist;
};

export function buildConsultativeDerived(
  facts: Record<string, unknown>,
  businessContext?: Record<string, unknown> | null,
): ConsultativeDerived {
  const nicheContext = resolveNicheContext(facts, businessContext);
  facts.niche_context = nicheContext;

  const accountFinancialGap = deriveAccountFinancialGap(facts, nicheContext, businessContext);
  if (accountFinancialGap) facts.account_financial_gap = accountFinancialGap;

  const learningRaw = deriveAdsetLearningStatus(facts);
  const adsetLearningStatus = enrichLearningWithSubstatus(learningRaw);
  if (adsetLearningStatus.length) {
    facts.adset_learning_status = adsetLearningStatus;
  }

  const deliverySummary = deriveDeliverySummary(facts, learningRaw);
  if (deliverySummary) facts.delivery_summary = deliverySummary;

  const conversionFunnel = deriveFunnelAnalysis(facts);
  const adsetBleedRanking = deriveAdsetBleedRanking(
    facts,
    nicheContext,
    new Map(learningRaw.map((r) => [r.adset_id, r.learning_status])),
  );
  if (adsetBleedRanking.length) facts.adset_bleed_ranking = adsetBleedRanking;

  const winnerUnderinvested =
    (facts.adset_winner_underinvested as WinnerUnderinvested | undefined) ??
    deriveWinnerUnderinvested(facts);
  if (winnerUnderinvested) facts.adset_winner_underinvested = winnerUnderinvested;

  const adVideoDiagnostics = deriveAdVideoDiagnostics(facts);
  if (adVideoDiagnostics.length) facts.ad_video_diagnostics = adVideoDiagnostics;

  const qaChecklist: ConsultativeQaChecklist = {
    hasBrlPerProblem: adsetBleedRanking.some((b) => b.bleedBrl > 0),
    hasNamedEntities:
      adsetBleedRanking.length > 0 ||
      Boolean(winnerUnderinvested?.adName),
    awarenessNotJudgedByRoas: true,
    learningReadBeforeRoas: learningRaw.length > 0,
    funnelBuiltWhenSales: conversionFunnel != null && conversionFunnel.purchase > 0,
    bestCreativeNamed: Boolean(
      winnerUnderinvested?.adName ||
        adVideoDiagnostics.some((v) => v.isBestCandidate),
    ),
    nicheBenchmarkApplied: nicheContext.confidence !== "low",
    plainLanguage: true,
    opensWithFinancialGap: Boolean(accountFinancialGap?.gapMonthlyBrl),
    hasSurpriseInsight:
      conversionFunnel?.bottleneck === "checkout" ||
      learningRaw.some((l) => l.learning_status === "learning_fail") ||
      Boolean(winnerUnderinvested),
  };

  const out: ConsultativeDerived = {
    nicheContext,
    accountFinancialGap,
    deliverySummary,
    conversionFunnel,
    adsetLearningStatus,
    adsetBleedRanking,
    winnerUnderinvested: winnerUnderinvested ?? null,
    adVideoDiagnostics,
    qaChecklist,
  };
  facts.consultative_derived = out;
  return out;
}
