import { type CampaignEnriched, enrichCampaigns, num } from "./campaign-objective.ts";
import { deriveAccountObjectiveSummary } from "./derive-analysis.ts";
import { deriveAdsetOverlapSignals } from "./derive-adset-audience.ts";
import {
  findDuplicateAudienceTargeting,
  summarizeAdsetTargeting,
} from "./derive-adset-targeting.ts";
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
  const adsetsInsights = Array.isArray(facts?.adsets_insights)
    ? (facts!.adsets_insights as Record<string, unknown>[])
    : [];
  const overlapSignals = deriveAdsetOverlapSignals(adsetsInsights);
  const targetingRows = summarizeAdsetTargeting(
    Array.isArray(facts?.adsets_targeting_sample)
      ? (facts!.adsets_targeting_sample as Record<string, unknown>[])
      : [],
  );
  const targetingDupes = findDuplicateAudienceTargeting(targetingRows);
  const hasAdsetData = adsetsInsights.length >= 2 || targetingRows.length > 0;

  const highFreqCamps = enriched.filter((c) => (c.frequency ?? 0) >= 5);
  const warnFreqCamps = enriched.filter(
    (c) => c.frequency != null && c.frequency >= 3.5 && c.frequency < 5,
  );

  // Check learning fail status — high frequency may be caused by learning fail, not true saturation
  const adsetLearningStatus = Array.isArray(facts?.adset_learning_status)
    ? (facts!.adset_learning_status as Record<string, unknown>[])
    : [];
  const learningFailAdsets = adsetLearningStatus.filter(
    (als) => String(als.learning_status ?? "") === "learning_fail",
  );
  let learningFailSpend = 0;
  let totalAdsetSpend = 0;
  for (const a of adsetsInsights) {
    const spend = num(a.spend as unknown) ?? 0;
    totalAdsetSpend += spend;
    const id = String(a.adset_id ?? "");
    if (learningFailAdsets.some((lf) => String(lf.adset_id) === id)) {
      learningFailSpend += spend;
    }
  }
  const learningFailIsMajorCause =
    learningFailAdsets.length > 0 &&
    (totalAdsetSpend === 0 || learningFailSpend / totalAdsetSpend >= 0.25);

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
  if (overlapSignals.length) {
    const o = overlapSignals[0];
    parts.push(
      `Ad sets na campanha "${o.campaign_name}": reach rate ${o.reach_rate_pct}% · freq ${o.frequency.toFixed(1).replace(".", ",")} (${o.note})`,
    );
    if (!summary.mixed_funnel) status = status === "good" ? "warning" : status;
  }
  if (targetingDupes.length) {
    const d = targetingDupes[0];
    parts.push(
      `${d.adset_ids.length} conjuntos na mesma campanha com mesmo custom_audience_id (${d.audience_id.slice(0, 12)}…)`,
    );
    if (!summary.mixed_funnel) status = status === "good" ? "warning" : status;
  }
  if (learningFailAdsets.length > 0) {
    const failedNames = learningFailAdsets.slice(0, 3).map((a) => String(a.adset_name ?? "")).filter(Boolean);
    const reasons = learningFailAdsets
      .filter((a) => a.learning_limited_reason)
      .map((a) => String(a.learning_limited_reason));
    const reasonNote = reasons.length > 0 ? ` · motivo: ${reasons[0]}` : "";
    parts.push(
      `${learningFailAdsets.length} conjunto(s) em learning fail${failedNames.length ? `: ${failedNames.join(", ")}` : ""}${reasonNote}`,
    );
  }

  let headline: string;
  if (accountFreq != null && accountFreq >= 3.5 && learningFailIsMajorCause) {
    const reason = String(learningFailAdsets[0]?.learning_limited_reason ?? "");
    const reasonNote = reason === "budget"
      ? "Remédio: aumentar budget ou mudar evento de otimização, NÃO expandir audiência."
      : reason === "audience"
        ? "Remédio: ampliar público ou mudar estratégia de lance."
        : "Remédio: verificar budget, evento de otimização e estrutura dos conjuntos.";
    headline = `Frequência elevada causada por learning fail (algoritmo sem otimizar) — não é saturação de público. ${reasonNote}`;
  } else if (summary.mixed_funnel) {
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
      : learningFailIsMajorCause
        ? "O algoritmo não conseguiu aprender porque não recebeu eventos de conversão suficientes. Expandir audiência nesse estado piora a situação — o algoritmo precisa de mais sinais, não de mais público."
        : "Público vendo o mesmo anúncio repetidamente tende a elevar custo e reduzir resposta.";

  return {
    id: "audience",
    title: "Diagnóstico de públicos",
    status,
    headline,
    evidence: parts.length ? parts.join(" · ") : "Dados de público limitados ao nível conta/campanha.",
    impactNote: impact,
    dataAvailable:
      hasAdsetData && (overlapSignals.length || targetingDupes.length)
        ? "full"
        : hasAdsetData
          ? "partial"
          : "partial",
  };
}
