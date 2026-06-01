import { computeRoas, num } from "./campaign-objective.ts";

export type AdVideoDiagnostic = {
  adId: string;
  adName: string;
  campaignName: string;
  spend: number;
  roas: number | null;
  hookRatePct: number | null;
  diagnosisPt: string;
  isBestCandidate: boolean;
  isWorstCandidate: boolean;
  pauseCandidate: boolean;
};

function actionCount(actions: unknown, pattern: RegExp): number {
  if (!Array.isArray(actions)) return 0;
  let n = 0;
  for (const a of actions as Record<string, unknown>[]) {
    const t = String(a.action_type ?? "");
    if (pattern.test(t)) n += num(a.value) ?? 0;
  }
  return n;
}

function videoMetric(row: Record<string, unknown>, field: string): number {
  const raw = row[field];
  if (Array.isArray(raw) && raw.length) {
    return num((raw[0] as Record<string, unknown>)?.value) ?? 0;
  }
  return 0;
}

export function deriveAdVideoDiagnostics(
  facts: Record<string, unknown> | null | undefined,
): AdVideoDiagnostic[] {
  const ads = Array.isArray(facts?.ads_insights_top)
    ? (facts!.ads_insights_top as Record<string, unknown>[])
    : Array.isArray(facts?.ads_insights_auction)
      ? (facts!.ads_insights_auction as Record<string, unknown>[])
      : [];
  if (!ads.length) return [];

  const scored: AdVideoDiagnostic[] = [];

  for (const a of ads) {
    const spend = num(a.spend) ?? 0;
    if (spend < 20) continue;
    const roas = computeRoas(a.action_values, spend);
    const v3 = videoMetric(a, "video_3_sec_watched_actions");
    const p25 = videoMetric(a, "video_p25_watched_actions");
    let hookRatePct: number | null = null;
    if (v3 > 0 && p25 > 0) {
      hookRatePct = Math.round((p25 / v3) * 1000) / 10;
    }

    let diagnosisPt = "Sem dados de vídeo no período.";
    if (hookRatePct != null) {
      if (hookRatePct < 15) {
        diagnosisPt =
          `Hook fraco: ${hookRatePct}% assistem até 25% após 3s — problema nos primeiros segundos.`;
      } else if (hookRatePct < 50) {
        diagnosisPt = `Retenção média no hook (${hookRatePct}%) — revisar corpo do vídeo.`;
      } else {
        diagnosisPt = `Hook forte (${hookRatePct}%) — se ROAS baixo, investigar página de destino.`;
      }
    }

    scored.push({
      adId: String(a.ad_id ?? ""),
      adName: String(a.ad_name ?? "").slice(0, 80),
      campaignName: String(a.campaign_name ?? "").slice(0, 60),
      spend,
      roas: roas != null ? Math.round(roas * 100) / 100 : null,
      hookRatePct,
      diagnosisPt,
      isBestCandidate: false,
      isWorstCandidate: false,
      pauseCandidate: false,
    });
  }

  if (!scored.length) return [];

  const withRoas = scored.filter((s) => s.roas != null && s.roas > 0);
  const avgRoas =
    withRoas.length > 0
      ? withRoas.reduce((s, x) => s + (x.roas ?? 0), 0) / withRoas.length
      : 0;

  for (const s of scored) {
    if (s.roas != null && avgRoas > 0) {
      s.isBestCandidate = s.roas >= avgRoas * 2 && s.spend < 500;
      s.isWorstCandidate =
        s.spend >= Math.max(100, avgRoas * 50) && s.roas < avgRoas * 0.5;
      s.pauseCandidate = s.isWorstCandidate;
    }
  }

  return scored.sort((a, b) => b.spend - a.spend).slice(0, 15);
}
