import { type CampaignEnriched, enrichCampaigns, num } from "./campaign-objective.ts";
import type { DiagnosticChapter, ChapterStatus } from "./derive-senior-types.ts";

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

export function deriveScaleDiagnosis(
  facts: Record<string, unknown> | null | undefined,
): DiagnosticChapter {
  const ins = (facts?.account_insights ?? {}) as Record<string, unknown>;
  const impressions = num(ins.impressions);
  const reach = num(ins.reach);
  const freq = num(ins.frequency);
  const enriched = getEnriched(facts);
  const totalSpend = enriched.reduce((s, c) => s + (c.spend ?? 0), 0);
  const goodSpend = enriched
    .filter((c) => c.kpi_status === "bom")
    .reduce((s, c) => s + (c.spend ?? 0), 0);
  const goodPct =
    totalSpend > 0 ? Math.round((goodSpend / totalSpend) * 1000) / 10 : null;

  let status: ChapterStatus = "info";
  if (goodPct != null && goodPct >= 55 && (freq == null || freq < 4)) status = "good";
  else if (goodPct != null && goodPct < 25) status = "warning";
  else if (freq != null && freq >= 5) status = "warning";
  else status = "info";

  const parts: string[] = [];
  if (impressions != null) parts.push(`Impressões conta: ${Math.round(impressions).toLocaleString("pt-BR")}`);
  if (reach != null) parts.push(`Alcance conta: ${Math.round(reach).toLocaleString("pt-BR")}`);
  if (freq != null) parts.push(`Frequência média: ${freq.toFixed(1).replace(".", ",")}`);
  if (goodPct != null) {
    parts.push(`${goodPct}% do gasto em campanhas com KPI "bom"`);
  }

  let headline: string;
  if (status === "good") {
    headline = "Há headroom indicativo para escalar verba nas campanhas com melhor KPI.";
  } else if (freq != null && freq >= 5) {
    headline = "Escala limitada no curto prazo — frequência alta sugere saturar antes de subir orçamento.";
  } else if (goodPct != null && goodPct < 25) {
    headline = "Pouca verba em campanhas saudáveis — priorizar otimização antes de escala agressiva.";
  } else {
    headline = "Capacidade de escala depende de estabilizar KPIs e criativos nas campanhas líderes.";
  }

  return {
    id: "scale",
    title: "Diagnóstico de escala",
    status,
    headline,
    evidence: parts.length ? parts.join(" · ") : "Sem métricas de conta para headroom.",
    impactNote:
      status === "warning"
        ? "Escalar com frequência alta ou KPI fraco costuma piorar ROAS marginal."
        : null,
    dataAvailable: enriched.length ? "full" : "partial",
  };
}
