/**
 * Tendência temporal: compara janela atual (14d) vs janela anterior (14d).
 * Usado para sinalizar problemas em deterioração vs crônicos.
 *
 * Esperamos que process-diagnosis popule `facts.trends`:
 * {
 *   windows: { current: {since, until}, previous: {since, until} },
 *   account: { roas?, ctr?, cpm?, cpa?, spend? } com {current, previous, deltaPct} cada,
 *   adsets:   Record<adsetId, { roas?, ctr?, cpm?, cpa?, spend? } com {current, previous, deltaPct}>
 * }
 *
 * Quando `facts.trends` não está disponível (conta nova, fetch falhou) todas as
 * funções devolvem `null` e o motor degrada para o comportamento atual.
 */

export type TrendDirection = "improving" | "stable" | "deteriorating" | "unknown";

export type TrendMetricSnapshot = {
  current: number | null;
  previous: number | null;
  deltaPct: number | null;
};

export type TrendSnapshot = {
  roas?: TrendMetricSnapshot;
  ctr?: TrendMetricSnapshot;
  cpm?: TrendMetricSnapshot;
  cpa?: TrendMetricSnapshot;
  spend?: TrendMetricSnapshot;
};

export type TrendsBundle = {
  windows: {
    current: { since: string; until: string };
    previous: { since: string; until: string };
  };
  account: TrendSnapshot | null;
  adsets: Record<string, TrendSnapshot>;
};

export type TrendVerdict = {
  direction: TrendDirection;
  metric: "roas" | "cpa" | "ctr" | "cpm" | null;
  deltaPct: number | null;
  /** Frase curta pronta para narrativa, ex.: "ROAS caiu de 7,2× para 5,1× (-29%) nas últimas 2 semanas". */
  summaryPt: string | null;
};

const THRESHOLD_PCT = 15;

const NEUTRAL: TrendVerdict = {
  direction: "unknown",
  metric: null,
  deltaPct: null,
  summaryPt: null,
};

function fmtRoas(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1).replace(".", ",")}×`;
}
function fmtBrl(v: number | null): string {
  if (v == null) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1).replace(".", ",")}%`;
}

/**
 * Classifica direção de uma métrica isolada.
 * - métricas "boas" (ROAS, CTR): queda ≥ THRESHOLD = deteriorating; alta ≥ THRESHOLD = improving
 * - métricas "ruins" (CPA, CPM): alta ≥ THRESHOLD = deteriorating; queda ≥ THRESHOLD = improving
 */
export function classifyTrend(
  metric: "roas" | "ctr" | "cpa" | "cpm" | "spend",
  current: number | null,
  previous: number | null,
): { direction: TrendDirection; deltaPct: number | null } {
  if (current == null || previous == null || previous === 0) {
    return { direction: "unknown", deltaPct: null };
  }
  const deltaPct = ((current - previous) / previous) * 100;
  if (Math.abs(deltaPct) < THRESHOLD_PCT) {
    return { direction: "stable", deltaPct };
  }
  const isGoodMetric = metric === "roas" || metric === "ctr";
  if (isGoodMetric) {
    return {
      direction: deltaPct >= THRESHOLD_PCT ? "improving" : "deteriorating",
      deltaPct,
    };
  }
  // ruins (CPA/CPM): alta é ruim
  return {
    direction: deltaPct >= THRESHOLD_PCT ? "deteriorating" : "improving",
    deltaPct,
  };
}

function snapshotVerdict(snap: TrendSnapshot | null | undefined): TrendVerdict {
  if (!snap) return NEUTRAL;
  // Prioridade: ROAS > CPA > CTR > CPM
  const candidates: ("roas" | "cpa" | "ctr" | "cpm")[] = ["roas", "cpa", "ctr", "cpm"];
  for (const m of candidates) {
    const s = snap[m];
    if (!s) continue;
    const c = classifyTrend(m, s.current, s.previous);
    if (c.direction === "deteriorating" || c.direction === "improving") {
      return {
        direction: c.direction,
        metric: m,
        deltaPct: c.deltaPct,
        summaryPt: buildSummary(m, s, c.deltaPct, c.direction),
      };
    }
  }
  // Sem mudança forte — retornar primeira métrica estável.
  for (const m of candidates) {
    const s = snap[m];
    if (!s) continue;
    const c = classifyTrend(m, s.current, s.previous);
    if (c.direction === "stable") {
      return {
        direction: "stable",
        metric: m,
        deltaPct: c.deltaPct,
        summaryPt: buildSummary(m, s, c.deltaPct, "stable"),
      };
    }
  }
  return NEUTRAL;
}

function buildSummary(
  metric: "roas" | "cpa" | "ctr" | "cpm",
  snap: TrendMetricSnapshot,
  deltaPct: number | null,
  direction: TrendDirection,
): string | null {
  if (snap.current == null || snap.previous == null) return null;
  const arrow =
    direction === "deteriorating" ? "🔻" : direction === "improving" ? "▲" : "▬";
  const fmt = metric === "roas" ? fmtRoas : metric === "cpa" || metric === "cpm" ? fmtBrl : fmtPct;
  const label =
    metric === "roas"
      ? "ROAS"
      : metric === "cpa"
        ? "CPA"
        : metric === "ctr"
          ? "CTR"
          : "CPM";
  const verbo =
    direction === "deteriorating"
      ? metric === "roas" || metric === "ctr"
        ? "caiu"
        : "subiu"
      : direction === "improving"
        ? metric === "roas" || metric === "ctr"
          ? "subiu"
          : "caiu"
        : "estável em";
  const tail =
    direction === "stable"
      ? `${fmt(snap.current)} (variação ${deltaPct != null ? fmtPct(deltaPct) : "—"})`
      : `de ${fmt(snap.previous)} para ${fmt(snap.current)} (${deltaPct != null && deltaPct > 0 ? "+" : ""}${
          deltaPct != null ? deltaPct.toFixed(0) : "—"
        }%)`;
  return `${arrow} ${label} ${verbo} ${tail} nas últimas 2 semanas`;
}

export function getAccountTrend(facts: Record<string, unknown> | null | undefined): TrendVerdict {
  const t = facts?.trends as TrendsBundle | undefined;
  if (!t?.account) return NEUTRAL;
  return snapshotVerdict(t.account);
}

export function getAdsetTrend(
  facts: Record<string, unknown> | null | undefined,
  adsetId: string | null | undefined,
): TrendVerdict {
  if (!adsetId) return NEUTRAL;
  const t = facts?.trends as TrendsBundle | undefined;
  const snap = t?.adsets?.[adsetId];
  if (!snap) return NEUTRAL;
  return snapshotVerdict(snap);
}

export function trendBadge(direction: TrendDirection): string {
  if (direction === "deteriorating") return "🔻 Em deterioração";
  if (direction === "improving") return "▲ Melhorando";
  if (direction === "stable") return "📊 Crônico";
  return "";
}
