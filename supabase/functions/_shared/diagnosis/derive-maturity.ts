import { type CampaignEnriched, enrichCampaigns, computeSpendMix } from "./campaign-objective.ts";
import type { CommercialDerived } from "./derive-commercial.ts";
import { deriveCreativeDependency } from "./derive-creative-diagnosis.ts";
import type { MaturityScore } from "./derive-senior-types.ts";

const LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Iniciante",
  2: "Em evolução",
  3: "Intermediário",
  4: "Avançado",
  5: "Elite",
};

function clampLevel(raw: number): 1 | 2 | 3 | 4 | 5 {
  const n = Math.round(raw);
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as 1 | 2 | 3 | 4 | 5;
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

function trackingScoreFromFacts(
  facts: Record<string, unknown> | null | undefined,
  commercial: CommercialDerived,
): { score: number; detail: string } {
  const enriched = getEnriched(facts);
  const sales = enriched.filter((c) => c.family === "sales");
  if (!sales.length) {
    return { score: 55, detail: "Sem campanhas de Vendas no recorte — rastreamento parcial." };
  }
  const noTrack = sales.filter((c) => c.kpi_status === "sem tracking");
  const noTrackSpend = noTrack.reduce((s, c) => s + c.spend, 0);
  const salesSpend = sales.reduce((s, c) => s + c.spend, 0);
  const share = salesSpend > 0 ? noTrackSpend / salesSpend : 0;
  if (share >= 0.5) {
    return {
      score: 20,
      detail: `${Math.round(share * 100)}% do gasto em Vendas sem compras rastreadas`,
    };
  }
  if (share > 0.15) {
    return { score: 55, detail: "Parte do gasto em Vendas sem compras atribuídas no período" };
  }
  if (commercial.accountEconomics.roasSales != null) {
    return { score: 90, detail: `ROAS Vendas ${commercial.accountEconomics.roasFormatted}` };
  }
  return { score: 70, detail: "Vendas com sinal de conversão no período" };
}

export function deriveMaturityScore(
  facts: Record<string, unknown> | null | undefined,
  commercial: CommercialDerived,
  healthScore: number,
): MaturityScore {
  const tracking = trackingScoreFromFacts(facts, commercial);
  const dep = deriveCreativeDependency(facts);
  const enriched = getEnriched(facts);
  const mix = computeSpendMix(enriched);
  const familyCount = Object.keys(mix).length;

  const trackingScore = tracking.score;
  const funnelScore = Math.min(100, familyCount * 28);
  const creativeScore = dep?.isHighDependency ? 35 : dep && dep.topAdSpendSharePct >= 40 ? 55 : 80;
  const healthNorm = Math.min(100, Math.max(0, healthScore));
  const diversityScore = familyCount >= 3 ? 85 : familyCount >= 2 ? 65 : 45;

  const pillars = [
    {
      id: "tracking",
      label: "Rastreamento",
      score: trackingScore,
      detail: tracking.detail,
    },
    {
      id: "funnel",
      label: "Mix de funil",
      score: funnelScore,
      detail: `${familyCount} família(s) de objetivo com gasto`,
    },
    {
      id: "creative",
      label: "Diversidade criativa",
      score: creativeScore,
      detail: dep
        ? `Top anúncio: ${dep.topAdSpendSharePct}% do gasto`
        : "Dados de anúncio limitados",
    },
    {
      id: "health",
      label: "Saúde da conta",
      score: healthNorm,
      detail: `Score de saúde: ${healthScore}/100`,
    },
    {
      id: "structure",
      label: "Estrutura",
      score: diversityScore,
      detail: `Famílias ativas no mix: ${familyCount}`,
    },
  ];

  const weighted =
    trackingScore * 0.25 +
    funnelScore * 0.15 +
    creativeScore * 0.2 +
    healthNorm * 0.25 +
    diversityScore * 0.15;

  const level = clampLevel(weighted / 20);
  const label = LABELS[level];

  const summary =
    level >= 4
      ? "Conta com maturidade alta — foco em escala controlada e testes criativos contínuos."
      : level === 3
        ? "Base sólida com gaps pontuais — priorizar tracking, criativo e campanhas em alerta."
        : level === 2
          ? "Operação em construção — consolidar estrutura e medição antes de escalar."
          : "Fundação ainda frágil — rastreamento, estrutura e criativo precisam de atenção imediata.";

  return { level, label, summary, pillars };
}
