/** Funções puras partilhadas pela auditoria de campanhas (IA). */

export type AuditCampaignFlags = {
  low_volume: boolean;
  zero_conv_with_spend: boolean;
  tracking_critical: boolean;
  requires_human_review: boolean;
  strong_platform_ga4_divergence: boolean;
  ga4_external_id_match: boolean;
};

export function formatYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysYMD(ymd: string, delta: number): string {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return formatYMD(d);
}

export function mapTrackingHealthForAudit(
  status: string | undefined,
  hasGa4Rows: boolean,
): "healthy" | "partial" | "broken" | "unavailable" {
  if (!hasGa4Rows) return "unavailable";
  const s = String(status ?? "").toLowerCase();
  if (s === "healthy") return "healthy";
  if (s === "warning") return "partial";
  if (s === "critical") return "broken";
  return "partial";
}

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokenSet(s: string): Set<string> {
  return new Set(normalizeName(s).split(/\s+/).filter(Boolean));
}

export function jaccardNames(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

export function matchScore(adName: string, ga4Name: string): number {
  const na = normalizeName(adName);
  const nb = normalizeName(ga4Name);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.82;
  return jaccardNames(adName, ga4Name);
}

export function extractJsonFromModelText(content: string): string {
  const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) return content.slice(start, end + 1);
  return content.trim();
}

const AGGRESSIVE_TYPES = new Set([
  "pause",
  "pausa",
  "scale",
  "escalar",
  "reduce_budget",
  "reduzir_orcamento",
  "budget_cut",
]);

export function clampRecommendations(
  recs: unknown[],
  flagsByCampaign: Map<string, AuditCampaignFlags>,
): unknown[] {
  return recs.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const r = { ...(raw as Record<string, unknown>) };
    const cid = String(r.campaign_id ?? "");
    const fl = cid ? flagsByCampaign.get(cid) : undefined;
    const st = String(r.suggestion_type ?? "").toLowerCase();
    if (fl?.low_volume && AGGRESSIVE_TYPES.has(st)) {
      r.suggestion_type = "investigate";
      r.requires_human_review = true;
      r.rationale = `${String(r.rationale ?? "")} [Governança: volume baixo — revisão humana obrigatória.]`;
    }
    if (fl?.tracking_critical && (st === "scale" || st === "escalar")) {
      r.suggestion_type = "investigate";
      r.requires_human_review = true;
    }
    if (
      fl?.strong_platform_ga4_divergence &&
      (st === "scale" || st === "escalar" || st === "pause" || st === "pausa")
    ) {
      r.suggestion_type = "investigate";
      r.requires_human_review = true;
      r.rationale = `${String(r.rationale ?? "")} [Governança: divergência forte plataforma vs GA4 atribuído.]`;
    }
    return r;
  });
}

/** Score para ordenar campanhas antes do prompt ao modelo (maior = mais prioritário). */
export function campaignAuditAggRankScore(
  x: {
    spend_30d: number;
    spend_prev7: number;
    roas_30d: number;
    tracking_match: string;
    flags: AuditCampaignFlags;
  },
  avgRoas: number,
): number {
  let s = x.spend_30d;
  if (x.flags.zero_conv_with_spend) s *= 1.8;
  const drop = x.spend_prev7 > 10 && x.roas_30d < avgRoas * 0.7 ? 50 : 0;
  s += drop;
  if (x.tracking_match === "unmatched") s += 30;
  return s;
}
