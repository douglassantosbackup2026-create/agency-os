import {
  type CampaignEnriched,
  enrichCampaigns,
  computeSpendMix,
} from "./campaign-objective.ts";
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

function statusFromSignals(critical: number, warn: number): ChapterStatus {
  if (critical >= 2) return "critical";
  if (critical >= 1 || warn >= 2) return "warning";
  if (warn >= 1) return "warning";
  return "good";
}

export function deriveStructureDiagnosis(
  facts: Record<string, unknown> | null | undefined,
): DiagnosticChapter {
  const enriched = getEnriched(facts);
  const sample = Array.isArray(facts?.campaigns_sample)
    ? (facts!.campaigns_sample as Record<string, unknown>[])
    : [];
  const active = sample.filter((c) => {
    const st = String(c.effective_status ?? c.status ?? "").toUpperCase();
    return st === "ACTIVE" || st === "PAUSED";
  });
  const mix = computeSpendMix(enriched);
  const families = Object.keys(mix).length;
  const salesAlert = enriched.filter(
    (c) => c.family === "sales" && (c.kpi_status === "alerta" || c.kpi_status === "sem tracking"),
  );
  const salesActive = enriched.filter((c) => c.family === "sales");

  const catalogLike = sample.filter((c) => {
    const o = String(c.objective ?? "").toUpperCase();
    return /CATALOG|ADVANTAGE|SHOP/i.test(o);
  });

  let status = statusFromSignals(
    salesAlert.filter((c) => c.kpi_status === "alerta").length,
    salesAlert.filter((c) => c.kpi_status === "atenção").length,
  );
  if (active.length > 12) status = status === "good" ? "warning" : status;

  const parts: string[] = [
    `${active.length} campanha(s) no recorte`,
    `${families} família(s) de objetivo no mix`,
  ];
  if (salesActive.length > 0) {
    parts.push(
      `${salesActive.length} de Vendas (${salesAlert.length} em alerta ou sem tracking)`,
    );
  }

  let headline: string;
  if (status === "good") {
    headline = "Estrutura enxuta para o volume analisado — mix de objetivos coerente com funil.";
  } else if (salesAlert.length >= 2 && salesActive.length >= 2) {
    headline = `${salesAlert.length} campanhas de Vendas com KPI crítico — risco de aprendizado fragmentado.`;
  } else if (active.length > 12) {
    headline = `${active.length} campanhas ativas/pausadas — possível complexidade operacional acima do ideal.`;
  } else {
    headline = "Há sinais de estrutura a simplificar antes de escalar verba.";
  }

  const impact =
    status === "good"
      ? null
      : "Muitas entidades ativas podem diluir aprendizado da Meta e inflar CPM médio.";

  if (catalogLike.length) {
    parts.push(`${catalogLike.length} campanha(s) com sinal de catálogo/Advantage+ no objective`);
  }

  return {
    id: "structure",
    title: "Diagnóstico da estrutura",
    status,
    headline,
    evidence: parts.join(" · "),
    impactNote: impact,
    dataAvailable: enriched.length ? "full" : sample.length ? "partial" : "none",
  };
}
