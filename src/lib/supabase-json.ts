import type { Json } from "@/integrations/supabase/types";

export function isJsonRecord(
  v: Json | null | undefined,
): v is { [key: string]: Json } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function getJsonNumber(
  obj: Json | null | undefined,
  key: string,
  fallback = 0,
): number {
  if (!isJsonRecord(obj)) return fallback;
  const n = obj[key];
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string" && n.trim() && Number.isFinite(Number(n)))
    return Number(n);
  return fallback;
}

/** Métricas comuns em `ai_output_json` de relatórios. */
export function getReportMetricsBlock(
  root: Json | null | undefined,
): {
  spend: number;
  revenue: number;
  roas: number;
  conv: number;
} {
  if (!isJsonRecord(root)) {
    return { spend: 0, revenue: 0, roas: 0, conv: 0 };
  }
  return {
    spend: getJsonNumber(root, "spend", 0),
    revenue: getJsonNumber(root, "revenue", 0),
    roas: getJsonNumber(root, "roas", 0),
    conv: getJsonNumber(root, "conv", 0),
  };
}

export function getJsonBlocks(
  v: Json | null | undefined,
): Json[] | null {
  if (!isJsonRecord(v)) return null;
  const b = v.blocks;
  if (!Array.isArray(b)) return null;
  return b as Json[];
}

/** `root[key]` quando é um objeto JSON (ex.: `score_explanation.blocks`). */
export function getJsonNestedRecord(
  root: Json | null | undefined,
  key: string,
): { [key: string]: Json } | null {
  if (!isJsonRecord(root)) return null;
  const inner = root[key];
  return isJsonRecord(inner) ? inner : null;
}

/** Mostra um valor JSON escalar; caso contrário usa `fallback`. */
export function jsonDisplay(
  v: Json | undefined | null,
  fallback: unknown,
): string {
  if (
    v !== null &&
    v !== undefined &&
    (typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean")
  ) {
    return String(v);
  }
  if (fallback !== null && fallback !== undefined) return String(fallback);
  return "—";
}

/** Métricas em `raw_data` incluindo campos GA4 opcionais. */
export function getReportRawDataView(root: Json | null | undefined): {
  spend: number;
  revenue: number;
  roas: number;
  conv: number;
  ga4_sessions: number;
  ga4_cvr: number;
  ga4_avg_ticket: number;
  ga4_tracking_status: string;
} {
  const base = getReportMetricsBlock(root);
  if (!isJsonRecord(root)) {
    return {
      ...base,
      ga4_sessions: 0,
      ga4_cvr: 0,
      ga4_avg_ticket: 0,
      ga4_tracking_status: "n/d",
    };
  }
  const ts = root.ga4_tracking_status;
  return {
    ...base,
    ga4_sessions: getJsonNumber(root, "ga4_sessions", 0),
    ga4_cvr: getJsonNumber(root, "ga4_cvr", 0),
    ga4_avg_ticket: getJsonNumber(root, "ga4_avg_ticket", 0),
    ga4_tracking_status: typeof ts === "string" ? ts : "n/d",
  };
}
