/**
 * Métricas opcionais de anúncio (Fase 2): outbound CTR e sinal de hook (vídeo).
 */

import { num } from "./campaign-objective.ts";

function actionValue(
  row: Record<string, unknown>,
  field: string,
  actionType?: string,
): number {
  const raw = row[field];
  if (raw == null) return 0;
  if (typeof raw === "string" || typeof raw === "number") return num(raw) ?? 0;
  if (!Array.isArray(raw)) return 0;
  for (const item of raw as Record<string, unknown>[]) {
    const t = String(item.action_type ?? "");
    if (actionType && t !== actionType) continue;
    const v = num(item.value);
    if (v != null) return v;
  }
  return 0;
}

export type AdCreativeSignals = {
  topOutboundCtrPct: number | null;
  topHookRatePct: number | null;
  note: string | null;
};

/** Extrai outbound CTR e proxy de hook (3s views / impressions) do top ad por gasto. */
export function deriveAdCreativeSignals(
  ads: Record<string, unknown>[] | undefined,
): AdCreativeSignals | null {
  if (!ads?.length) return null;
  const sorted = [...ads].sort((a, b) => (num(b.spend) ?? 0) - (num(a.spend) ?? 0));
  const top = sorted[0];
  const impressions = num(top.impressions) ?? 0;
  const clicks = num(top.clicks) ?? 0;
  const outbound = actionValue(top, "outbound_clicks", "outbound_click");
  const video3s = actionValue(top, "video_3_sec_watched_actions");

  let topOutboundCtrPct: number | null = null;
  if (impressions > 0 && outbound > 0) {
    topOutboundCtrPct = Math.round((outbound / impressions) * 10000) / 100;
  } else if (impressions > 0 && clicks > 0) {
    const obCtr = actionValue(top, "outbound_clicks_ctr");
    if (obCtr > 0) topOutboundCtrPct = Math.round(obCtr * 100) / 100;
  }

  let topHookRatePct: number | null = null;
  if (impressions > 0 && video3s > 0) {
    topHookRatePct = Math.round((video3s / impressions) * 10000) / 100;
  }

  const parts: string[] = [];
  if (topOutboundCtrPct != null) {
    parts.push(`Outbound CTR do top anúncio: ${topOutboundCtrPct}%`);
  }
  if (topHookRatePct != null) {
    parts.push(`Hook proxy (3s/impressões): ${topHookRatePct}%`);
  }
  if (!parts.length) return null;

  return {
    topOutboundCtrPct,
    topHookRatePct,
    note: parts.join(" · "),
  };
}
