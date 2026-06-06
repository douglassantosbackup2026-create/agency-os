/**
 * Benchmarks Páprika v1.0 / BR v2 — re-exporta fonte canônica do loader.
 */

export type {
  BenchmarkTier,
  CalcularStatusResult,
  NicheBenchmarkV1,
  StatusContext,
  TieredMetric,
} from "./benchmark-loader.ts";

export {
  benchmarkGapNote,
  calcularGapFinanceiro,
  calcularImpactoCheckout,
  calcularStatus,
  getNicheBenchmarksV1,
  METRIC_INTERNAL_TO_JSON,
  METRIC_JSON_TO_INTERNAL,
  nicheKeyToVertical,
  referenceRoasIdeal,
  referenciaIdeal,
  resolveVerticalFromTermo,
  ticketMedioReferencia,
  VERTICAL_TO_NICHE_KEY,
} from "./benchmark-loader.ts";

import {
  benchmarkGapNote,
  getNicheBenchmarksV1,
  referenceRoasIdeal,
} from "./benchmark-loader.ts";
import type { BenchmarkTier, NicheBenchmarkV1, TieredMetric } from "./benchmark-loader.ts";

export const NICHE_BENCHMARKS_V1: Record<string, NicheBenchmarkV1> = getNicheBenchmarksV1();

export function classifyTier(value: number, metric: TieredMetric): BenchmarkTier {
  const { higherIsBetter, atencao, bom, excelente } = metric;
  if (higherIsBetter) {
    if (value >= excelente) return "excelente";
    if (value >= bom[0]) return "bom";
    if (value >= atencao[0]) return "atencao";
    return "ruim";
  }
  if (value <= excelente) return "excelente";
  if (value <= bom[1]) return "bom";
  if (value <= atencao[1]) return "atencao";
  return "ruim";
}

/** ROAS de referência ideal do nicho (v2 JSON). */
export function referenceRoasBom(nicheKey: string): number {
  return referenceRoasIdeal(nicheKey);
}

export function formatTierGapNote(
  metricLabel: string,
  current: number,
  nicheKey: string,
  metricKey: keyof Pick<NicheBenchmarkV1, "roas" | "cpm" | "ctrConversion" | "cpp" | "frequencia">,
  _formatFn: (n: number) => string,
): string {
  const jsonKey =
    metricKey === "ctrConversion"
      ? "ctr_conversao"
      : metricKey === "frequencia"
        ? "frequencia"
        : metricKey;
  return (
    benchmarkGapNote(nicheKey, jsonKey, current) ||
    `${metricLabel}: valor fora da faixa saudável do nicho.`
  );
}
