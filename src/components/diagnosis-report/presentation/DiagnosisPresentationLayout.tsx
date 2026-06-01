import { useMemo } from "react";
import { buildRoadmapFromActionPlan } from "@/lib/diagnosis-roadmap";
import type {
  ConsultativeDerived,
  DiagnosisAnalysis,
  FinancialBalance,
  MetaSeniorDerived,
  SeniorDerived,
  TopFinding,
} from "../types";
import { DiagnosisConversionFunnelBlock } from "./DiagnosisConversionFunnelBlock";
import { DiagnosisCreativesWinnerBlock } from "./DiagnosisCreativesWinnerBlock";
import { DiagnosisDeliveryStatusBlock } from "./DiagnosisDeliveryStatusBlock";
import { DiagnosisFinancialGapBlock } from "./DiagnosisFinancialGapBlock";
import { DiagnosisAccountHealthStrip } from "./DiagnosisAccountHealthStrip";
import { DiagnosisAudienceTrends } from "./DiagnosisAudienceTrends";
import { DiagnosisCreativeAuctionGrid } from "./DiagnosisCreativeAuctionGrid";
import { DiagnosisExecutiveStrip } from "./DiagnosisExecutiveStrip";
import { DiagnosisFunnelHealth } from "./DiagnosisFunnelHealth";
import { DiagnosisPriorityRecommendations } from "./DiagnosisPriorityRecommendations";
import { DiagnosisFooterCta } from "./DiagnosisFooterCta";
import { DiagnosisLossGrid } from "./DiagnosisLossGrid";
import { DiagnosisOpportunityGrid } from "./DiagnosisOpportunityGrid";
import { DiagnosisPresentationHero } from "./DiagnosisPresentationHero";
import {
  DiagnosisPresentationNav,
  type PresentationNavItem,
} from "./DiagnosisPresentationNav";
import { DiagnosisProblemsMasterDetail } from "./DiagnosisProblemsMasterDetail";
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
  const verdictLine =
    analysis.verdictLine?.trim() ||
    analysis.narrativeHook?.trim() ||
    analysis.storyExecutive?.headline ||
    analysis.summary.split(".")[0] ||
    "";

  const leakTotalFormatted = seniorDerived?.leakByAxis?.length
    ? seniorDerived.leakByAxis
        .reduce((s, i) => s + i.monthlyBrl, 0)
        .toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        })
    : null;

  const benchmarkNote = (() => {
    const gaps = analysis.benchmarkComparison?.gaps ?? [];
    const bad = gaps.find((g) => g.isBad);
    if (bad?.gapNote) return bad.gapNote;
    const niche = analysis.benchmarkComparison?.nicheLabel;
    return niche ? `Referência: ${niche}` : null;
  })();

  const plan = analysis.prioritizedActions?.length
    ? analysis.prioritizedActions
    : (analysis.actionPlan ?? []);
  const roadmap = buildRoadmapFromActionPlan(plan);

  const hasLeak = Boolean(seniorDerived?.leakByAxis?.length);
  const hasOpportunities =
    Boolean(seniorDerived?.growthScenarios) ||
    Boolean(analysis.opportunities?.length);
  const hasIssues = Boolean(analysis.criticalIssues?.length);
  const hasRoadmap =
    roadmap.short.length > 0 || roadmap.mid.length > 0 || roadmap.long.length > 0;

  const hasMetaSenior = Boolean(
    metaSenior?.auctionDiagnostics?.length ||
      metaSenior?.adsetTrends?.length ||
      metaSenior?.recommendations?.length,
  );

  const c = consultative ?? analysis.consultativeDerived ?? null;

  const navItems = useMemo(() => {
    const items: PresentationNavItem[] = [
      { id: "veredito", label: "Veredito" },
    ];
    if (c?.accountFinancialGap) items.push({ id: "bloco-impacto", label: "Impacto R$" });
    if (c?.deliverySummary) items.push({ id: "bloco-entrega", label: "Entrega" });
    items.push({ id: "resumo-executivo", label: "Resumo" });
    if (hasMetaSenior) {
      items.push({ id: "sec-account-health", label: "Meta" });
      if (metaSenior?.auctionDiagnostics?.length) {
        items.push({ id: "sec-auction", label: "Leilão" });
      }
      if (metaSenior?.adsetTrends?.length) {
        items.push({ id: "sec-trends", label: "Tendências" });
      }
      if (metaSenior?.recommendations?.length) {
        items.push({ id: "sec-recos", label: "Recomendações" });
      }
      if (metaSenior?.funnelHealth?.length) {
        items.push({ id: "sec-funnel", label: "Funil" });
      }
    }
    if (c?.conversionFunnel) items.push({ id: "bloco-funil", label: "Funil" });
    if (c?.winnerUnderinvested || (c?.adVideoDiagnostics?.length ?? 0) > 0) {
      items.push({ id: "bloco-criativos", label: "Criativos" });
    }
    if (hasIssues) items.push({ id: "sec-issues", label: "Problemas" });
    if (hasLeak) items.push({ id: "vazamentos", label: "Vazamentos" });
    if (hasOpportunities) items.push({ id: "crescimento", label: "Oportunidades" });
    if (hasRoadmap) items.push({ id: "sec-roadmap", label: "Plano 90d" });
    items.push({ id: "sec-footer-cta", label: "Próximo passo" });
    items.push({ id: "sec-technical", label: "Anexo técnico" });
    return items;
  }, [c, hasIssues, hasLeak, hasMetaSenior, hasOpportunities, hasRoadmap, metaSenior]);

  const economicsSingle = hasLeak !== hasOpportunities;

  return (
    <>
      <DiagnosisPresentationHero
        score={score}
        scoreLabel={scoreLabel}
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

      {hasIssues ? (
        <DiagnosisProblemsMasterDetail
          issues={analysis.criticalIssues!}
          senior={seniorDerived}
          priorityBadge={priorityBadge}
          axisLabelPt={axisLabelPt}
        />
      ) : null}

      {hasLeak || hasOpportunities ? (
        <div
          className={
            economicsSingle
              ? "presentation-economics-row presentation-economics-row--single"
              : "presentation-economics-row"
          }
        >
          {hasLeak ? (
            <DiagnosisLossGrid
              items={seniorDerived!.leakByAxis}
              totalFormatted={leakTotalFormatted}
            />
          ) : null}
          {hasOpportunities ? (
            <DiagnosisOpportunityGrid
              growth={seniorDerived?.growthScenarios}
              opportunities={analysis.opportunities}
            />
          ) : null}
        </div>
      ) : null}

      <DiagnosisRoadmapTimeline
        roadmap={roadmap}
        growth={seniorDerived?.growthScenarios}
      />

      <DiagnosisFooterCta
        onPrimaryCta={onScrollToManagementCta}
        whatsappHref={whatsappGestaoHref}
      />
    </>
  );
}
