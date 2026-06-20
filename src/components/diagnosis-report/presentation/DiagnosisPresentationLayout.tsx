import { useMemo } from "react";
import { buildRoadmapFromActionPlan } from "@/lib/diagnosis-roadmap";
import { DiagnosisMaturityCard } from "../DiagnosisMaturityCard";
import { DiagnosisRisksCard } from "../DiagnosisRisksCard";
import type {
  ConsultativeDerived,
  DiagnosisAnalysis,
  FinancialBalance,
  MetaSeniorDerived,
  SeniorDerived,
  TopFinding,
} from "../types";
import { DiagnosisBenchmarkImpactBlock } from "./DiagnosisBenchmarkImpactBlock";
import { DiagnosisConversionFunnelBlock } from "./DiagnosisConversionFunnelBlock";
import { DiagnosisCreativesWinnerBlock } from "./DiagnosisCreativesWinnerBlock";
import { DiagnosisDeliveryStatusBlock } from "./DiagnosisDeliveryStatusBlock";
import { DiagnosisExecutiveConclusion } from "./DiagnosisExecutiveConclusion";
import { DiagnosisFinancialGapBlock } from "./DiagnosisFinancialGapBlock";
import { DiagnosisAccountHealthStrip } from "./DiagnosisAccountHealthStrip";
import { DiagnosisAudienceTrends } from "./DiagnosisAudienceTrends";
import { DiagnosisCreativeAuctionGrid } from "./DiagnosisCreativeAuctionGrid";
import { DiagnosisExecutiveStrip } from "./DiagnosisExecutiveStrip";
import { DiagnosisFunnelHealth } from "./DiagnosisFunnelHealth";
import { DiagnosisPriorityRecommendations } from "./DiagnosisPriorityRecommendations";
import { DiagnosisFooterCta } from "./DiagnosisFooterCta";
import { DiagnosisLossGrid } from "./DiagnosisLossGrid";
import { DiagnosisMoneyLeakGrid } from "./DiagnosisMoneyLeakGrid";
import { DiagnosisOpportunityGrid } from "./DiagnosisOpportunityGrid";
import { DiagnosisPresentationHero } from "./DiagnosisPresentationHero";
import {
  DiagnosisPresentationNav,
  type PresentationNavItem,
} from "./DiagnosisPresentationNav";
import { DiagnosisProblemsMasterDetail } from "./DiagnosisProblemsMasterDetail";
import { DiagnosisProjectionsBlock } from "./DiagnosisProjectionsBlock";
import { DiagnosisRoadmapTimeline } from "./DiagnosisRoadmapTimeline";

type Props = {
  analysis: DiagnosisAnalysis;
  metaSenior?: MetaSeniorDerived | null;
  consultative?: ConsultativeDerived | null;
  seniorDerived: SeniorDerived | null;
  financialBalance: FinancialBalance | null;
  topFindings: TopFinding[];
  score: number;
  scoreTier: "low" | "mid" | "high";
  scoreLabel: string;
  priorityBadge: (priority: string) => string;
  axisLabelPt: (axis: string) => string;
  onScrollToManagementCta?: () => void;
  whatsappGestaoHref?: string;
  accountLabel?: string | null;
  periodLabel?: string | null;
  completedAtLabel?: string | null;
};

export function DiagnosisPresentationLayout({
  analysis,
  metaSenior = null,
  consultative = null,
  seniorDerived,
  financialBalance,
  topFindings,
  score,
  scoreTier,
  scoreLabel,
  priorityBadge,
  axisLabelPt,
  onScrollToManagementCta,
  whatsappGestaoHref,
  accountLabel,
  periodLabel = "Últimos 30 dias",
  completedAtLabel,
}: Props) {
  const gi = analysis.growthIntelligenceDerived ?? null;
  const verdictLine =
    analysis.verdictLine?.trim() ||
    gi?.executiveImpact.headlinePt ||
    analysis.narrativeHook?.trim() ||
    analysis.storyExecutive?.headline ||
    analysis.summary.split(".")[0] ||
    "";

  const moneyLeakTotal = gi?.moneyLeaks?.length
    ? gi.moneyLeaks.reduce((s, l) => s + l.monthlyImpactBrl, 0)
    : seniorDerived?.leakByAxis?.reduce((s, i) => s + i.monthlyBrl, 0) ?? 0;

  const leakTotalFormatted =
    moneyLeakTotal > 0
      ? moneyLeakTotal.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        })
      : null;

  const benchmarkNote = (() => {
    const bad = gi?.benchmarkImpacts?.[0]?.tierNote;
    if (bad) return bad;
    const gaps = analysis.benchmarkComparison?.gaps ?? [];
    const g = gaps.find((x) => x.isBad);
    if (g?.gapNote) return g.gapNote;
    const niche = analysis.benchmarkComparison?.nicheLabel;
    return niche ? `Referência: ${niche}` : null;
  })();

  const plan = analysis.prioritizedActions?.length
    ? analysis.prioritizedActions
    : (analysis.actionPlan ?? []);
  const roadmap = buildRoadmapFromActionPlan(plan);

  const hasMoneyLeaks = Boolean(gi?.moneyLeaks?.length);
  const hasLeakAxis = Boolean(seniorDerived?.leakByAxis?.length);
  const hasOpportunities =
    Boolean(gi?.growthOpportunities?.length) ||
    Boolean(seniorDerived?.growthScenarios) ||
    Boolean(analysis.opportunities?.length);
  const hasIssues = Boolean(analysis.criticalIssues?.length);
  const hasRoadmap =
    roadmap.short.length > 0 || roadmap.mid.length > 0 || roadmap.long.length > 0;
  const hasRisks = Boolean(gi?.risks?.length || seniorDerived?.risks?.length);
  const hasBenchmark = Boolean(gi?.benchmarkImpacts?.length);
  const hasMaturity = Boolean(gi?.maturity || seniorDerived?.maturity);
  const hasProjections = Boolean(gi?.projections?.scenarios?.length);
  const hasConclusion = Boolean(analysis.executiveConclusion);

  const hasMetaSenior = Boolean(
    metaSenior?.auctionDiagnostics?.length ||
      metaSenior?.adsetTrends?.length ||
      metaSenior?.recommendations?.length,
  );

  const c = consultative ?? analysis.consultativeDerived ?? null;

  const navItems = useMemo(() => {
    const items: PresentationNavItem[] = [{ id: "veredito", label: "Executivo" }];
    if (c?.accountFinancialGap) items.push({ id: "bloco-impacto", label: "Impacto R$" });
    if (hasMoneyLeaks || hasLeakAxis) items.push({ id: "vazamentos", label: "Na mesa" });
    if (hasOpportunities) items.push({ id: "crescimento", label: "Crescimento" });
    if (hasIssues) items.push({ id: "sec-issues", label: "Gargalos" });
    if (hasRisks) items.push({ id: "sec-risks", label: "Riscos" });
    if (hasBenchmark) items.push({ id: "sec-benchmark", label: "Benchmark" });
    if (hasMaturity) items.push({ id: "maturidade", label: "Maturidade" });
    if (hasRoadmap) items.push({ id: "sec-roadmap", label: "Plano" });
    if (hasProjections) items.push({ id: "sec-projections", label: "Potencial" });
    if (hasConclusion) items.push({ id: "sec-conclusao", label: "Conclusão" });
    if (c?.deliverySummary) items.push({ id: "bloco-entrega", label: "Entrega" });
    items.push({ id: "resumo-executivo", label: "KPIs" });
    if (hasMetaSenior) items.push({ id: "sec-account-health", label: "Meta técnico" });
    if (c?.conversionFunnel) items.push({ id: "bloco-funil", label: "Funil checkout" });
    if (c?.winnerUnderinvested || (c?.adVideoDiagnostics?.length ?? 0) > 0) {
      items.push({ id: "bloco-criativos", label: "Criativos" });
    }
    items.push({ id: "sec-footer-cta", label: "Próximo passo" });
    items.push({ id: "sec-technical", label: "Anexo" });
    return items;
  }, [
    c,
    hasBenchmark,
    hasConclusion,
    hasIssues,
    hasLeakAxis,
    hasMetaSenior,
    hasMoneyLeaks,
    hasMaturity,
    hasOpportunities,
    hasProjections,
    hasRisks,
    hasRoadmap,
  ]);

  return (
    <>
      <DiagnosisPresentationHero
        score={gi?.maturity?.score0to100 ?? score}
        scoreLabel={gi?.maturity?.enterpriseLabel ?? scoreLabel}
        scoreTier={scoreTier}
        verdictLine={verdictLine}
        leakTotalFormatted={leakTotalFormatted}
        benchmarkNote={benchmarkNote}
        accountLabel={accountLabel}
        periodLabel={periodLabel}
        completedAtLabel={completedAtLabel}
      />

      <DiagnosisPresentationNav items={navItems} />

      {c?.accountFinancialGap ? (
        <DiagnosisFinancialGapBlock gap={c.accountFinancialGap} />
      ) : gi?.executiveImpact ? (
        <section className="card presentation-impact-fallback" id="bloco-impacto">
          <p className="presentation-section-eyebrow">01 · Impacto</p>
          <h2 className="premium-section-title">Diagnóstico executivo</h2>
          <p className="premium-section-hint">{gi.executiveImpact.headlinePt}</p>
        </section>
      ) : null}

      {hasMoneyLeaks ? (
        <DiagnosisMoneyLeakGrid
          leaks={gi!.moneyLeaks}
          totalFormatted={leakTotalFormatted}
          isHealthy={gi?.accountHealth?.isHealthy}
        />
      ) : hasLeakAxis ? (
        <DiagnosisLossGrid
          items={seniorDerived!.leakByAxis}
          totalFormatted={leakTotalFormatted}
        />
      ) : null}

      {hasOpportunities ? (
        <DiagnosisOpportunityGrid
          growth={seniorDerived?.growthScenarios}
          opportunities={analysis.opportunities}
          growthIntel={gi?.growthOpportunities}
        />
      ) : null}

      {hasIssues ? (
        <DiagnosisProblemsMasterDetail
          issues={analysis.criticalIssues!}
          senior={seniorDerived}
          priorityBadge={priorityBadge}
          axisLabelPt={axisLabelPt}
        />
      ) : null}

      {hasRisks && seniorDerived?.risks?.length ? (
        <section className="presentation-risks-wrap">
          <DiagnosisRisksCard risks={seniorDerived.risks} />
        </section>
      ) : null}

      {hasBenchmark && gi ? (
        <DiagnosisBenchmarkImpactBlock
          impacts={gi.benchmarkImpacts}
          nicheLabel={analysis.benchmarkComparison?.nicheLabel}
        />
      ) : null}

      {hasMaturity && seniorDerived ? (
        <DiagnosisMaturityCard
          maturity={seniorDerived.maturity}
          enterprise={gi?.maturity ?? null}
        />
      ) : null}

      {hasRoadmap ? (
        <DiagnosisRoadmapTimeline
          roadmap={roadmap}
          growth={seniorDerived?.growthScenarios}
        />
      ) : null}

      {hasProjections && gi ? <DiagnosisProjectionsBlock projections={gi.projections} /> : null}

      {hasConclusion && analysis.executiveConclusion ? (
        <DiagnosisExecutiveConclusion conclusion={analysis.executiveConclusion} />
      ) : null}

      {c?.deliverySummary ? (
        <DiagnosisDeliveryStatusBlock summary={c.deliverySummary} />
      ) : null}

      <DiagnosisExecutiveStrip
        balance={financialBalance}
        analysis={analysis}
        topFinding={topFindings[0] ?? null}
      />

      {hasMetaSenior && metaSenior ? (
        <>
          <DiagnosisAccountHealthStrip meta={metaSenior} />
          <DiagnosisCreativeAuctionGrid rows={metaSenior.auctionDiagnostics} />
          <DiagnosisAudienceTrends trends={metaSenior.adsetTrends} />
          <DiagnosisPriorityRecommendations items={metaSenior.recommendations} />
          <DiagnosisFunnelHealth rows={metaSenior.funnelHealth} />
        </>
      ) : null}

      {c?.conversionFunnel ? (
        <DiagnosisConversionFunnelBlock funnel={c.conversionFunnel} />
      ) : null}

      {c?.winnerUnderinvested || (c?.adVideoDiagnostics?.length ?? 0) > 0 ? (
        <DiagnosisCreativesWinnerBlock
          winner={c?.winnerUnderinvested}
          videos={c?.adVideoDiagnostics ?? []}
        />
      ) : null}

      <DiagnosisFooterCta
        onPrimaryCta={onScrollToManagementCta}
        whatsappHref={whatsappGestaoHref}
      />
    </>
  );
}
