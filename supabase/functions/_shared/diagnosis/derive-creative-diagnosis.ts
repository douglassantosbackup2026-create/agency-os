import { computeRoas, num } from "./campaign-objective.ts";
import type { BenchmarkComparison } from "./derive-commercial.ts";
import type { DiagnosticChapter, ChapterStatus } from "./derive-senior-types.ts";

export type CreativeDependency = {
  topAdSpendSharePct: number;
  topAdPurchaseSharePct: number | null;
  topAdName: string | null;
  isHighDependency: boolean;
};

export function deriveCreativeDependency(
  facts: Record<string, unknown> | null | undefined,
): CreativeDependency | null {
  const ads = Array.isArray(facts?.ads_insights_top)
    ? (facts!.ads_insights_top as Record<string, unknown>[])
    : [];
  if (ads.length < 2) return null;

  const sorted = [...ads].sort((a, b) => (num(b.spend) ?? 0) - (num(a.spend) ?? 0));
  const totalSpend = sorted.reduce((s, a) => s + (num(a.spend) ?? 0), 0);
  if (totalSpend <= 0) return null;

  const top = sorted[0];
  const topSpend = num(top.spend) ?? 0;
  const topSpendSharePct = Math.round((topSpend / totalSpend) * 1000) / 10;

  const withPurchase = sorted.filter((a) => {
    const spend = num(a.spend) ?? 0;
    const roas = computeRoas(a.action_values, spend);
    return roas != null && roas > 0;
  });
  let topAdPurchaseSharePct: number | null = null;
  if (withPurchase.length > 0) {
    const topPurchaser = withPurchase[0];
    const totalRev = withPurchase.reduce((s, a) => {
      const spend = num(a.spend) ?? 0;
      const roas = computeRoas(a.action_values, spend);
      return s + (roas != null ? roas * spend : 0);
    }, 0);
    const topRev =
      (computeRoas(topPurchaser.action_values, num(topPurchaser.spend) ?? 0) ?? 0) *
      (num(topPurchaser.spend) ?? 0);
    if (totalRev > 0) {
      topAdPurchaseSharePct = Math.round((topRev / totalRev) * 1000) / 10;
    }
  }

  const isHighDependency =
    topSpendSharePct >= 50 || (topAdPurchaseSharePct != null && topAdPurchaseSharePct >= 55);

  return {
    topAdSpendSharePct: topSpendSharePct,
    topAdPurchaseSharePct,
    topAdName: String(top.ad_name ?? top.ad_id ?? "").slice(0, 80) || null,
    isHighDependency,
  };
}

export function deriveCreativeDiagnosis(
  facts: Record<string, unknown> | null | undefined,
  benchmark?: BenchmarkComparison,
): DiagnosticChapter {
  const ads = Array.isArray(facts?.ads_insights_top)
    ? (facts!.ads_insights_top as Record<string, unknown>[])
    : [];
  const dep = deriveCreativeDependency(facts);
  const ctrGap = benchmark?.gaps.find((g) => /ctr/i.test(g.metric));

  let status: ChapterStatus = "info";
  if (!ads.length) {
    return {
      id: "creative",
      title: "Diagnóstico criativo",
      status: "na",
      headline: "Insights ao nível de anúncio insuficientes no período.",
      evidence: "Sem ads_insights_top para analisar concentração ou fadiga.",
      impactNote: null,
      dataAvailable: "none",
    };
  }

  if (dep?.isHighDependency) status = "critical";
  else if (ctrGap?.isBad) status = "warning";
  else if (dep && dep.topAdSpendSharePct >= 35) status = "warning";
  else status = "good";

  const parts: string[] = [`${ads.length} anúncios no top por gasto`];
  if (dep) {
    parts.push(
      `Maior anúncio concentra ${dep.topAdSpendSharePct}% do gasto analisado`,
    );
    if (dep.topAdPurchaseSharePct != null) {
      parts.push(`~${dep.topAdPurchaseSharePct}% das compras rastreadas no top criativo`);
    }
    if (dep.topAdName) parts.push(`Top: ${dep.topAdName}`);
  }
  if (ctrGap) {
    parts.push(`CTR conta vs nicho: ${ctrGap.current} (ref. ${ctrGap.reference})`);
  }

  let headline: string;
  if (dep?.isHighDependency && dep.topAdPurchaseSharePct != null) {
    headline = `Dependência de criativo: 1 anúncio concentra ~${dep.topAdPurchaseSharePct}% das compras — risco alto se saturar.`;
  } else if (dep?.isHighDependency) {
    headline = `Dependência de criativo: ${dep.topAdSpendSharePct}% do gasto em um único anúncio.`;
  } else if (status === "good") {
    headline = "Distribuição de gasto entre anúncios relativamente equilibrada no recorte.";
  } else {
    headline = "Criativos abaixo do benchmark de CTR — espaço para renovação e testes.";
  }

  return {
    id: "creative",
    title: "Diagnóstico criativo",
    status,
    headline,
    evidence: parts.join(" · "),
    impactNote:
      status === "critical"
        ? "70% do resultado costuma vir de criativos — concentração eleva risco operacional."
        : ctrGap?.isBad
          ? "CTR baixo costuma preceder aumento de CPM e queda de eficiência."
          : null,
    dataAvailable: ads.length >= 3 ? "full" : "partial",
  };
}
