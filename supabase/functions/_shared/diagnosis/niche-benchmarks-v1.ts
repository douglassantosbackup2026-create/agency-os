/**
 * Benchmarks Páprika v1.0 — tiers por nicho (referência de mercado BR).
 */

export type BenchmarkTier = "ruim" | "atencao" | "bom" | "excelente";

export type TieredMetric = {
  ruim: number;
  atencao: [number, number];
  bom: [number, number];
  excelente: number;
  higherIsBetter: boolean;
};

export type NicheBenchmarkV1 = {
  key: string;
  label: string;
  roas?: TieredMetric;
  cpm?: TieredMetric;
  ctrConversion?: TieredMetric;
  cpp?: TieredMetric;
  frequencia?: TieredMetric;
  purchaseCheckoutRate?: TieredMetric;
  atcLpvRate?: TieredMetric;
};

function t(
  ruim: number,
  atencaoLo: number,
  atencaoHi: number,
  bomLo: number,
  bomHi: number,
  excelente: number,
  higherIsBetter: boolean,
): TieredMetric {
  return {
    ruim,
    atencao: [atencaoLo, atencaoHi],
    bom: [bomLo, bomHi],
    excelente,
    higherIsBetter,
  };
}

export const NICHE_BENCHMARKS_V1: Record<string, NicheBenchmarkV1> = {
  ecom_moda: {
    key: "ecom_moda",
    label: "Moda e acessórios",
    roas: t(4, 4, 6, 6, 9, 9, true),
    cpm: t(60, 40, 60, 20, 40, 20, false),
    ctrConversion: t(1, 1, 2, 2, 4, 4, true),
    cpp: t(200, 120, 200, 60, 120, 60, false),
    frequencia: t(5, 3, 5, 2, 3, 1.5, false),
    purchaseCheckoutRate: t(30, 30, 45, 45, 60, 60, true),
    atcLpvRate: t(3, 3, 6, 6, 10, 10, true),
  },
  ecom_beleza: {
    key: "ecom_beleza",
    label: "Beleza e cosméticos",
    roas: t(5, 5, 8, 8, 12, 12, true),
    cpm: t(50, 30, 50, 15, 30, 15, false),
    ctrConversion: t(1.5, 1.5, 2.5, 2.5, 5, 5, true),
    cpp: t(150, 80, 150, 40, 80, 40, false),
    frequencia: t(5, 3, 5, 2, 3, 1.5, false),
  },
  ecom_casa: {
    key: "ecom_casa",
    label: "Casa e decoração",
    roas: t(4, 4, 7, 7, 10, 10, true),
    cpm: t(55, 35, 55, 18, 35, 18, false),
    ctrConversion: t(0.8, 0.8, 1.5, 1.5, 3, 3, true),
    cpp: t(250, 150, 250, 80, 150, 80, false),
    frequencia: t(4, 3, 4, 2, 3, 1.5, false),
  },
  ecom_eletronicos: {
    key: "ecom_eletronicos",
    label: "Eletrônicos e tecnologia",
    roas: t(6, 6, 10, 10, 15, 15, true),
    cpm: t(65, 40, 65, 20, 40, 20, false),
    ctrConversion: t(0.5, 0.5, 1, 1, 2, 2, true),
    cpp: t(300, 180, 300, 80, 180, 80, false),
    frequencia: t(3, 2, 3, 1.5, 2, 1, false),
  },
  ecom_esportes: {
    key: "ecom_esportes",
    label: "Esportes e fitness",
    roas: t(4, 4, 7, 7, 11, 11, true),
    cpm: t(45, 28, 45, 14, 28, 14, false),
    ctrConversion: t(1.2, 1.2, 2, 2, 4, 4, true),
    cpp: t(180, 100, 180, 50, 100, 50, false),
    frequencia: t(5, 3, 5, 2, 3, 1.5, false),
  },
  ecom_alimentos: {
    key: "ecom_alimentos",
    label: "Alimentos, bebidas e suplementos",
    roas: t(6, 6, 10, 10, 15, 15, true),
    cpm: t(40, 25, 40, 12, 25, 12, false),
    ctrConversion: t(1, 1, 2, 2, 4, 4, true),
    cpp: t(120, 70, 120, 35, 70, 35, false),
    frequencia: t(4, 3, 4, 2, 3, 1.5, false),
  },
  ecom_geral: {
    key: "ecom_geral",
    label: "E-commerce geral",
    roas: t(3, 3, 5, 5, 8, 8, true),
    cpm: t(50, 30, 50, 18, 35, 18, false),
    ctrConversion: t(1, 1, 2, 2, 3.5, 3.5, true),
    cpp: t(180, 100, 180, 60, 120, 60, false),
    frequencia: t(5, 3, 5, 2, 3, 1.5, false),
    purchaseCheckoutRate: t(35, 35, 50, 50, 65, 65, true),
    atcLpvRate: t(3, 3, 6, 6, 10, 10, true),
  },
};

export function classifyTier(
  value: number,
  metric: TieredMetric,
): BenchmarkTier {
  const { higherIsBetter, ruim, atencao, bom, excelente } = metric;
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

/** ROAS de referência "bom" (mínimo saudável) para gap financeiro. */
export function referenceRoasBom(nicheKey: string): number {
  const b = NICHE_BENCHMARKS_V1[nicheKey] ?? NICHE_BENCHMARKS_V1.ecom_geral;
  return b.roas?.bom[0] ?? 5;
}

export function formatTierGapNote(
  metricLabel: string,
  current: number,
  nicheKey: string,
  metricKey: keyof Pick<NicheBenchmarkV1, "roas" | "cpm" | "ctrConversion" | "cpp" | "frequencia">,
  formatFn: (n: number) => string,
): string {
  const bench = NICHE_BENCHMARKS_V1[nicheKey] ?? NICHE_BENCHMARKS_V1.ecom_geral;
  const m = bench[metricKey];
  if (!m) return "";
  const tier = classifyTier(current, m);
  const ref = m.bom[0];
  const pct = ref > 0
    ? Math.round(Math.abs((current - ref) / ref) * 100)
    : 0;
  const dir = m.higherIsBetter
    ? current < ref ? "abaixo" : "acima"
    : current > ref ? "acima" : "abaixo";
  return `${metricLabel}: sua conta ${formatFn(current)} · Referência ${bench.label}: ${formatFn(ref)} (${tier}) · Você está ${pct}% ${dir} do mínimo saudável.`;
}
