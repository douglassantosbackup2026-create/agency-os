import { type CampaignEnriched, enrichCampaigns, num } from "./campaign-objective.ts";
import { deriveAccountObjectiveSummary } from "./derive-analysis.ts";
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

export function deriveAudienceDiagnosis(
  facts: Record<string, unknown> | null | undefined,
): DiagnosticChapter {
  const summary = deriveAccountObjectiveSummary(facts);
  const ins = (facts?.account_insights ?? {}) as Record<string, unknown>;
  const accountFreq = num(ins.frequency);
  const impressions = num(ins.impressions);
  const reach = num(ins.reach);
  const enriched = getEnriched(facts);

  const highFreqCamps = enriched.filter((c) => (c.frequency ?? 0) >= 5);
  const warnFreqCamps = enriched.filter(
    (c) => c.frequency != null && c.frequency >= 3.5 && c.frequency < 5,
  );

  let status: ChapterStatus = "good";
  if (accountFreq != null && accountFreq >= 5) status = "critical";
  else if (highFreqCamps.length > 0 || (accountFreq != null && accountFreq >= 3.5)) {
    status = "warning";
  }

  const reachRate =
    impressions != null && reach != null && impressions > 0
      ? (reach / impressions) * 100
      : null;

  const parts: string[] = [];
  if (accountFreq != null) {
    parts.push(`Frequência média conta (30d): ${accountFreq.toFixed(1).replace(".", ",")}`);
  }
  if (reachRate != null) {
    parts.push(`Reach rate conta: ${reachRate.toFixed(0)}%`);
  }
  if (highFreqCamps.length) {
    parts.push(
      `${highFreqCamps.length} campanha(s) com frequência ≥ 5: ${highFreqCamps.map((c) => c.name).slice(0, 2).join(", ")}`,
    );
  }

  let headline: string;
  if (summary.mixed_funnel) {
    headline =
      status === "good"
        ? "Funil misto com objetivos distintos — isso não indica sobreposição de público entre campanhas."
        : accountFreq != null && accountFreq >= 5
          ? `Frequência ${accountFreq.toFixed(1).replace(".", ",")} na conta — possível saturação no recorte analisado.`
          : `Atenção em frequência em campanha(s) específica(s) — revisar criativo/público nelas.`;
  } else if (status === "good") {
    headline = "Frequência e alcance dentro de faixa aceitável no período.";
  } else {
    headline = `Sinais de saturação de público (frequência elevada) — impacto em CPM e CTR.`;
  }

  const impact =
    status === "good"
      ? null
      : "Público vendo o mesmo anúncio repetidamente tende a elevar custo e reduzir resposta.";

  return {
    id: "audience",
    title: "Diagnóstico de públicos",
    status,
    headline,
    evidence: parts.length ? parts.join(" · ") : "Dados de público limitados ao nível conta/campanha.",
    impactNote: impact,
    dataAvailable: "partial",
  };
}
