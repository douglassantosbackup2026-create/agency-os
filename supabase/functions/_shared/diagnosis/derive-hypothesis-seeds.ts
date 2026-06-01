import type { CommercialDerived } from "./derive-commercial.ts";
import { type CampaignEnriched, enrichCampaigns } from "./campaign-objective.ts";
import { deriveCreativeDependency } from "./derive-creative-diagnosis.ts";
import { deriveAccountObjectiveSummary } from "./derive-analysis.ts";
import { deriveAdsetOverlapSignals } from "./derive-adset-audience.ts";
import type { SeniorDerived } from "./derive-senior-types.ts";

export type HypothesisConfidence = "high" | "medium" | "needs_data";

export type HypothesisSeed = {
  id: string;
  axis: "structure" | "audience" | "creative" | "sales" | "scale";
  title: string;
  claim: string;
  evidenceFor: string[];
  evidenceAgainst: string[];
  confidence: HypothesisConfidence;
  relatedRiskId?: string;
  monthlyBrlHint?: number;
};

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

export function deriveHypothesisSeeds(
  facts: Record<string, unknown> | null | undefined,
  senior: SeniorDerived,
  commercial: CommercialDerived,
): HypothesisSeed[] {
  const seeds: HypothesisSeed[] = [];
  const summary = deriveAccountObjectiveSummary(facts);
  const enriched = getEnriched(facts);
  const dep = deriveCreativeDependency(facts);

  if (summary.mixed_funnel) {
    seeds.push({
      id: "funnel-mixed-not-overlap",
      axis: "audience",
      title: "Funil misto — objetivos distintos",
      claim:
        "Coexistência de campanhas com objetivos diferentes reflete funil (topo/meio/fundo), não sobreposição de público.",
      evidenceFor: [
        `${summary.by_family.length} famílias de objetivo com gasto no período`,
        summary.by_family.map((f) => `${f.label} ${f.spend_pct}%`).join(" · "),
      ],
      evidenceAgainst: [
        "Sem reach rate baixo + frequência alta na mesma campanha com múltiplos ad sets",
      ],
      confidence: "high",
    });
  }

  const adsetsInsights = Array.isArray(facts?.adsets_insights)
    ? (facts!.adsets_insights as Record<string, unknown>[])
    : [];
  const overlapSignals = deriveAdsetOverlapSignals(adsetsInsights);
  if (
    overlapSignals.length &&
    senior.diagnostics.audience.dataAvailable === "full" &&
    !summary.mixed_funnel
  ) {
    const o = overlapSignals[0];
    seeds.push({
      id: "audience-overlap-adset",
      axis: "audience",
      title: "Possível sobreposição entre conjuntos",
      claim: `Conjuntos na campanha "${o.campaign_name}" com sinais de reach rate baixo e frequência elevada.`,
      evidenceFor: [o.note, `Reach rate ~${o.reach_rate_pct}% · freq ${o.frequency}`],
      evidenceAgainst: [],
      confidence: "medium",
      relatedRiskId: "audience-frequency",
    });
  }

  if (dep?.isHighDependency) {
    const leakCreative = senior.leakByAxis.find((l) => l.axis === "creative");
    seeds.push({
      id: "creative-single-asset-risk",
      axis: "creative",
      title: "Dependência de um único criativo",
      claim:
        "Grande parte do gasto (e possivelmente das compras) concentra-se em um anúncio — risco de colapso se saturar.",
      evidenceFor: [
        `Top anúncio: ${dep.topAdSpendSharePct}% do gasto analisado`,
        dep.topAdPurchaseSharePct != null
          ? `~${dep.topAdPurchaseSharePct}% das compras rastreadas no top criativo`
          : "Concentração de gasto no top ad",
      ],
      evidenceAgainst: dep.topAdSpendSharePct < 45 ? ["Distribuição ainda moderada entre ads"] : [],
      confidence: dep.topAdSpendSharePct >= 55 ? "high" : "medium",
      relatedRiskId: "creative-dependency",
      monthlyBrlHint: leakCreative?.monthlyBrl,
    });
  }

  const salesCamps = enriched.filter((c) => c.family === "sales" && c.spend > 50);
  const salesAlert = salesCamps.filter((c) => c.kpi_status === "alerta");
  if (salesCamps.length >= 2 && salesAlert.length >= 2) {
    const roasVals = salesCamps
      .map((c) => c.roas)
      .filter((r): r is number => r != null && r > 0);
    const spread =
      roasVals.length >= 2
        ? Math.max(...roasVals) / Math.min(...roasVals)
        : 1;
    seeds.push({
      id: "sales-roas-dispersion",
      axis: "sales",
      title: "ROAS agregado pode esconder campanhas fracas",
      claim:
        "Várias campanhas de Vendas com desempenho divergente — a média pode parecer saudável enquanto parte do gasto perde dinheiro.",
      evidenceFor: [
        `${salesAlert.length} de ${salesCamps.length} campanhas de Vendas em alerta`,
        spread >= 2 ? `Dispersão de ROAS entre campanhas (ratio ~${spread.toFixed(1)}x)` : "",
      ].filter(Boolean),
      evidenceAgainst: salesAlert.length === 0 ? ["Todas as campanhas de Vendas saudáveis"] : [],
      confidence: spread >= 2.5 ? "high" : "medium",
      relatedRiskId: "waste-high",
      monthlyBrlHint: commercial.waste.totalMonthlyBrl,
    });
  }

  if (senior.diagnostics.audience.status === "critical") {
    const ins = (facts?.account_insights ?? {}) as Record<string, unknown>;
    const freq = Number(ins.frequency);
    seeds.push({
      id: "audience-saturation-signal",
      axis: "audience",
      title: "Saturação ou frequência elevada",
      claim:
        "Frequência alta na conta pode indicar público vendo o mesmo anúncio repetidamente — validar criativo e exclusões.",
      evidenceFor: [
        Number.isFinite(freq) ? `Frequência conta: ${freq}` : senior.diagnostics.audience.evidence,
        ...(freq >= 5 ? ["Frequência ≥ 5 sustentada"] : []),
      ],
      evidenceAgainst:
        summary.mixed_funnel
          ? ["Funil misto — frequência na conta pode ser normal com alcance + conversão"]
          : [],
      confidence: Number.isFinite(freq) && freq >= 5 ? "high" : "medium",
      relatedRiskId: "audience-frequency",
    });
  }

  if (senior.diagnostics.structure.status === "warning" || senior.diagnostics.structure.status === "critical") {
    seeds.push({
      id: "structure-complexity",
      axis: "structure",
      title: "Estrutura a simplificar",
      claim: senior.diagnostics.structure.headline,
      evidenceFor: [senior.diagnostics.structure.evidence],
      evidenceAgainst: [],
      confidence: "medium",
      relatedRiskId: "structure-fragmented",
    });
  }

  for (const risk of senior.risks) {
    if (seeds.some((s) => s.relatedRiskId === risk.id)) continue;
    seeds.push({
      id: `risk-${risk.id}`,
      axis: (risk.relatedAxis === "scale" ? "scale" : risk.relatedAxis) ?? "sales",
      title: risk.title,
      claim: risk.title,
      evidenceFor: [risk.evidence],
      evidenceAgainst: [],
      confidence: risk.severity === "critical" ? "high" : "medium",
      relatedRiskId: risk.id,
    });
  }

  return seeds.slice(0, 10);
}
