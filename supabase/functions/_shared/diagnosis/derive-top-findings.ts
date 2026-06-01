/**
 * Top 3 achados determinísticos por campanha (R$ + ação) — fonte para UI v10 e prompt.
 */

import {
  type CampaignEnriched,
  type DerivedStatus,
  enrichCampaigns,
} from "./campaign-objective.ts";
import type { BenchmarkComparison, WasteBreakdown } from "./derive-commercial.ts";

/** Espelha derive-commercial — evita import circular. */
function campaignWasteFraction(c: CampaignEnriched): number {
  if (c.family === "sales") {
    if (c.kpi_status === "sem tracking") return 1;
    if (c.kpi_status === "alerta") {
      if (c.roas != null && c.roas < 1) return 1;
      return 0.55;
    }
    if (c.kpi_status === "atenção") return 0.3;
    return 0;
  }
  if (c.kpi_status === "alerta") return 0.12;
  if (c.kpi_status === "atenção") return 0.05;
  return 0;
}

function fmtBRL(n: number): string {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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

export type TopFindingSeverity = "critical" | "warning" | "info";

export type TopFinding = {
  rank: number;
  severity: TopFindingSeverity;
  campaignName: string;
  objectiveFamily: string;
  kpiStatus: DerivedStatus;
  monthlyImpactBrl: number;
  monthlyImpactFormatted: string;
  headline: string;
  actionHint: string;
  evidence: string;
};

function severityFromStatus(s: DerivedStatus): TopFindingSeverity {
  if (s === "alerta" || s === "sem tracking") return "critical";
  if (s === "atenção") return "warning";
  return "info";
}

function actionHintFor(c: CampaignEnriched): string {
  if (c.kpi_status === "sem tracking") {
    return "Revisar pixel, evento de compra e janela de atribuição antes de escalar verba.";
  }
  if (c.family === "sales" && c.kpi_status === "alerta") {
    if (c.roas != null && c.roas < 1) {
      return "Pausar ou reduzir orçamento até corrigir criativo, público ou landing.";
    }
    return "Otimizar criativos e públicos; testar exclusão de compradores em prospecção.";
  }
  if (c.kpi_status === "atenção") {
    return "Monitorar diariamente; ajustar lances ou renovar criativos se KPI piorar.";
  }
  if (c.family === "awareness" && c.frequency != null && c.frequency > 5) {
    return "Ampliar público ou pausar conjuntos com frequência alta para evitar saturação.";
  }
  return "Revisar configuração e KPI do objetivo no Gerenciador.";
}

function evidenceFor(c: CampaignEnriched): string {
  if (c.family === "sales") {
    if (c.roas != null) return `ROAS ${c.roas.toFixed(2).replace(".", ",")}x · gasto ${fmtBRL(c.spend)}`;
    return `Sem compras rastreadas · gasto ${fmtBRL(c.spend)}`;
  }
  const pr = c.primary_result;
  const cpr =
    pr.cost_per_result != null
      ? ` · custo ${fmtBRL(pr.cost_per_result)}`
      : "";
  if (c.frequency != null && c.frequency > 4) {
    return `${pr.label_pt} · frequência ${c.frequency.toFixed(1).replace(".", ",")}${cpr}`;
  }
  if (c.ctr_link != null) {
    return `${pr.label_pt} · CTR ${c.ctr_link.toFixed(2).replace(".", ",")}%${cpr}`;
  }
  return `${pr.label_pt} · gasto ${fmtBRL(c.spend)}${cpr}`;
}

function headlineFor(c: CampaignEnriched, impact: number): string {
  const impactFmt = fmtBRL(impact);
  const name = c.name.length > 42 ? `${c.name.slice(0, 39)}…` : c.name;
  if (c.kpi_status === "sem tracking") {
    return `${name} — ${impactFmt}/mês sem vendas rastreadas`;
  }
  if (c.family === "sales" && c.roas != null) {
    return `${name} — ROAS ${c.roas.toFixed(1).replace(".", ",")}x → ~${impactFmt}/mês em risco`;
  }
  if (c.frequency != null && c.frequency > 5) {
    return `${name} — frequência ${c.frequency.toFixed(1).replace(".", ",")} → ~${impactFmt}/mês`;
  }
  return `${name} (${c.family_label_pt}) — ~${impactFmt}/mês a recuperar`;
}

type Candidate = {
  kind: "campaign";
  campaign: CampaignEnriched;
  impact: number;
};

function campaignCandidates(facts: Record<string, unknown> | null | undefined): Candidate[] {
  const enriched = getEnriched(facts);
  const out: Candidate[] = [];
  for (const c of enriched) {
    if (
      c.kpi_status !== "alerta" &&
      c.kpi_status !== "atenção" &&
      c.kpi_status !== "sem tracking"
    ) {
      continue;
    }
    const impact = c.spend * campaignWasteFraction(c);
    if (impact <= 0 && c.kpi_status !== "sem tracking") continue;
    const effectiveImpact =
      c.kpi_status === "sem tracking" ? c.spend : Math.max(impact, c.spend * 0.05);
    out.push({ kind: "campaign", campaign: c, impact: effectiveImpact });
  }
  return out.sort((a, b) => b.impact - a.impact);
}

function benchmarkFallback(
  bench: BenchmarkComparison | undefined,
  usedNames: Set<string>,
): TopFinding | null {
  if (!bench) return null;
  const worst = bench.gaps
    .filter((g) => g.status === "below" && g.isBad)
    .sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))[0];
  if (!worst) return null;
  const key = `benchmark:${worst.metric}`;
  if (usedNames.has(key)) return null;
  usedNames.add(key);
  return {
    rank: 0,
    severity: "warning",
    campaignName: "Conta (agregado)",
    objectiveFamily: "conta",
    kpiStatus: "atenção",
    monthlyImpactBrl: 0,
    monthlyImpactFormatted: "—",
    headline: `${worst.metric}: ${worst.current} vs mercado ${worst.reference} (${worst.deltaLabel ?? ""})`,
    actionHint: "Priorizar métrica abaixo do nicho antes de escalar investimento.",
    evidence: worst.gapNote,
  };
}

function wasteLineFallback(
  waste: WasteBreakdown,
  usedNames: Set<string>,
): TopFinding | null {
  const line = waste.lines.sort((a, b) => b.monthlyBrl - a.monthlyBrl)[0];
  if (!line || line.monthlyBrl <= 0) return null;
  const name = line.campaignNames[0] ?? "Várias campanhas";
  if (usedNames.has(name)) return null;
  usedNames.add(name);
  return {
    rank: 0,
    severity: "warning",
    campaignName: name,
    objectiveFamily: "mix",
    kpiStatus: "atenção",
    monthlyImpactBrl: line.monthlyBrl,
    monthlyImpactFormatted: fmtBRL(line.monthlyBrl),
    headline: `${line.label} — ${fmtBRL(line.monthlyBrl)}/mês`,
    actionHint: "Corrigir campanhas listadas no breakdown de desperdício.",
    evidence: line.campaignNames.slice(0, 3).join(", "),
  };
}

type AdsetBleedRowFacts = {
  adsetName?: string;
  campaignName?: string;
  bleedBrl?: number;
  bleedFormatted?: string;
  roasFormatted?: string;
};

function bleedAdsetTopFinding(
  facts: Record<string, unknown> | null | undefined,
): TopFinding | null {
  const ranking = facts?.adset_bleed_ranking;
  if (!Array.isArray(ranking) || ranking.length === 0) return null;
  const top = ranking[0] as AdsetBleedRowFacts;
  const bleedBrl = typeof top.bleedBrl === "number" ? top.bleedBrl : 0;
  if (bleedBrl < 50) return null;
  const adsetName = String(top.adsetName ?? "Conjunto de anúncios");
  const campaignName = String(top.campaignName ?? "");
  const roasFmt = String(top.roasFormatted ?? "—");
  const severity: TopFindingSeverity = bleedBrl >= 500 ? "critical" : "warning";
  const shortName = adsetName.length > 42 ? `${adsetName.slice(0, 39)}…` : adsetName;
  return {
    rank: 0,
    severity,
    campaignName: adsetName,
    objectiveFamily: campaignName || "conjunto",
    kpiStatus: "alerta",
    monthlyImpactBrl: bleedBrl,
    monthlyImpactFormatted: top.bleedFormatted ?? fmtBRL(bleedBrl),
    headline: `${shortName} — ~${fmtBRL(bleedBrl)}/mês abaixo do ROAS do nicho`,
    actionHint:
      "Reduzir verba, pausar ou reestruturar público e criativo neste conjunto antes de escalar.",
    evidence: `ROAS ${roasFmt}${campaignName ? ` · campanha ${campaignName}` : ""}`,
  };
}

function paretoFallback(
  waste: WasteBreakdown,
  usedNames: Set<string>,
): TopFinding | null {
  if (!waste.paretoAds?.note || usedNames.has("pareto:ads")) return null;
  usedNames.add("pareto:ads");
  return {
    rank: 0,
    severity: "info",
    campaignName: "Anúncios (top gasto)",
    objectiveFamily: "ads",
    kpiStatus: "atenção",
    monthlyImpactBrl: 0,
    monthlyImpactFormatted: "—",
    headline: waste.paretoAds.note.slice(0, 120),
    actionHint: "Redistribuir verba dos anúncios sem compra rastreada para os que convertem.",
    evidence: `Top ${waste.paretoAds.topSpendSharePct}% do gasto em anúncios`,
  };
}

export function deriveTopFindings(
  facts: Record<string, unknown> | null | undefined,
  waste: WasteBreakdown,
  benchmark?: BenchmarkComparison,
): TopFinding[] {
  const w = waste;
  const candidates = campaignCandidates(facts);
  const usedNames = new Set<string>();
  const findings: TopFinding[] = [];

  const bleedLead = bleedAdsetTopFinding(facts);
  if (bleedLead) {
    findings.push({ ...bleedLead, rank: 1 });
    usedNames.add(bleedLead.campaignName);
  }

  for (const cand of candidates) {
    if (findings.length >= 3) break;
    const c = cand.campaign;
    if (usedNames.has(c.campaign_id)) continue;
    usedNames.add(c.campaign_id);
    findings.push({
      rank: findings.length + 1,
      severity: severityFromStatus(c.kpi_status),
      campaignName: c.name,
      objectiveFamily: c.family_label_pt,
      kpiStatus: c.kpi_status,
      monthlyImpactBrl: Math.round(cand.impact),
      monthlyImpactFormatted: fmtBRL(cand.impact),
      headline: headlineFor(c, cand.impact),
      actionHint: actionHintFor(c),
      evidence: evidenceFor(c),
    });
  }

  while (findings.length < 3) {
    const fillers = [
      () => wasteLineFallback(w, usedNames),
      () => benchmarkFallback(benchmark, usedNames),
      () => paretoFallback(w, usedNames),
    ];
    let added = false;
    for (const fill of fillers) {
      const f = fill();
      if (f) {
        findings.push({ ...f, rank: findings.length + 1 });
        added = true;
        break;
      }
    }
    if (!added) break;
  }

  if (findings.length === 0 && w.totalMonthlyBrl > 0) {
    findings.push({
      rank: 1,
      severity: "warning",
      campaignName: "Conta",
      objectiveFamily: "mix",
      kpiStatus: "atenção",
      monthlyImpactBrl: w.totalMonthlyBrl,
      monthlyImpactFormatted: w.totalFormatted,
      headline: `Até ${w.totalFormatted}/mês em verba Meta em risco ou sem visibilidade`,
      actionHint: "Revisar campanhas de Vendas e rastreamento de compras.",
      evidence: w.lines.map((l) => l.label).join("; ").slice(0, 200),
    });
  }

  if (findings.length === 0) {
    const enriched = getEnriched(facts);
    const salesGood = enriched
      .filter((c) => c.family === "sales" && c.kpi_status === "bom" && c.roas != null)
      .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
    const lead = salesGood[0] ?? enriched.sort((a, b) => b.spend - a.spend)[0];
    if (lead) {
      findings.push({
        rank: 1,
        severity: "info",
        campaignName: lead.name,
        objectiveFamily: lead.family_label_pt,
        kpiStatus: lead.kpi_status,
        monthlyImpactBrl: 0,
        monthlyImpactFormatted: "—",
        headline:
          lead.roas != null
            ? `${lead.name} — ROAS ${lead.roas.toFixed(1).replace(".", ",")}x (referência para escalar)`
            : `${lead.name} — principal campanha por gasto no período`,
        actionHint: "Consolidar aprendizado desta campanha antes de abrir novos testes.",
        evidence: evidenceFor(lead),
      });
    }
  }

  return findings.map((f, i) => ({ ...f, rank: i + 1 }));
}
