/**
 * Benchmarks BR v2 — carrega benchmarks-br-v2.json como fonte canônica.
 */

import raw from "./benchmarks-br-v2.json" with { type: "json" };

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

type FaixaDef = {
  operador: string;
  valor?: number;
  min?: number;
  max?: number;
  label: string;
  cor: string;
};

type MetricDef = {
  label: string;
  unidade: string;
  referencia_ideal: number;
  faixas: Record<string, FaixaDef>;
  mensagem_ruim?: string;
  mensagem_bom?: string;
};

type VerticalDef = {
  label: string;
  ticket_medio_referencia?: { min: number; max: number; moeda: string };
  metricas: Record<string, MetricDef>;
};

type BenchmarksRaw = {
  verticais: Record<string, VerticalDef>;
  mapeamento_subvertical?: { mapa: Record<string, string> };
};

const BENCHMARKS = raw as BenchmarksRaw;

export const VERTICAL_TO_NICHE_KEY: Record<string, string> = {
  moda_acessorios: "ecom_moda",
  beleza_cosmeticos: "ecom_beleza",
  casa_decoracao: "ecom_casa",
  eletronicos_tecnologia: "ecom_eletronicos",
  esportes_fitness: "ecom_esportes",
  alimentos_suplementos: "ecom_alimentos",
};

export const NICHE_KEY_TO_VERTICAL: Record<string, string> = Object.fromEntries(
  Object.entries(VERTICAL_TO_NICHE_KEY).map(([v, k]) => [k, v]),
);

export const METRIC_JSON_TO_INTERNAL: Record<string, keyof NicheBenchmarkV1> = {
  roas: "roas",
  cpm: "cpm",
  ctr_conversao: "ctrConversion",
  cpp: "cpp",
  frequencia: "frequencia",
  taxa_checkout_compra: "purchaseCheckoutRate",
  taxa_atc_lpv: "atcLpvRate",
};

export const METRIC_INTERNAL_TO_JSON: Partial<Record<keyof NicheBenchmarkV1, string>> =
  Object.fromEntries(
    Object.entries(METRIC_JSON_TO_INTERNAL).map(([json, internal]) => [internal, json]),
  );

const HIGHER_IS_BETTER_JSON = new Set([
  "roas",
  "ctr_conversao",
  "taxa_checkout_compra",
  "taxa_atc_lpv",
]);

function faixasToTiered(
  faixas: Record<string, FaixaDef>,
  higherIsBetter: boolean,
): TieredMetric {
  const ruim = faixas.ruim;
  const atencao = faixas.atencao;
  const bom = faixas.bom;
  const excelente = faixas.excelente;
  if (higherIsBetter) {
    return {
      ruim: ruim?.valor ?? atencao?.min ?? 0,
      atencao: [atencao?.min ?? 0, atencao?.max ?? 0],
      bom: [bom?.min ?? 0, bom?.max ?? 0],
      excelente: excelente?.valor ?? bom?.max ?? 0,
      higherIsBetter: true,
    };
  }
  return {
    ruim: ruim?.valor ?? atencao?.max ?? 999,
    atencao: [atencao?.min ?? 0, atencao?.max ?? 0],
    bom: [bom?.min ?? 0, bom?.max ?? 0],
    excelente: excelente?.valor ?? bom?.min ?? 0,
    higherIsBetter: false,
  };
}

function buildVerticalBenchmark(verticalKey: string, vertical: VerticalDef): NicheBenchmarkV1 {
  const nicheKey = VERTICAL_TO_NICHE_KEY[verticalKey] ?? verticalKey;
  const entry: NicheBenchmarkV1 = { key: nicheKey, label: vertical.label };
  for (const [jsonMetric, def] of Object.entries(vertical.metricas)) {
    const internal = METRIC_JSON_TO_INTERNAL[jsonMetric];
    if (!internal || internal === "key" || internal === "label") continue;
    entry[internal] = faixasToTiered(def.faixas, HIGHER_IS_BETTER_JSON.has(jsonMetric));
  }
  return entry;
}

function buildEcomGeralFallback(): NicheBenchmarkV1 {
  const moda = BENCHMARKS.verticais.moda_acessorios;
  const base = buildVerticalBenchmark("moda_acessorios", moda);
  return {
    ...base,
    key: "ecom_geral",
    label: "E-commerce geral",
    roas: {
      ruim: 3,
      atencao: [3, 5],
      bom: [5, 8],
      excelente: 8,
      higherIsBetter: true,
    },
  };
}

let _cache: Record<string, NicheBenchmarkV1> | null = null;

export function getNicheBenchmarksV1(): Record<string, NicheBenchmarkV1> {
  if (_cache) return _cache;
  const out: Record<string, NicheBenchmarkV1> = {};
  for (const [verticalKey, vertical] of Object.entries(BENCHMARKS.verticais)) {
    const bench = buildVerticalBenchmark(verticalKey, vertical);
    out[bench.key] = bench;
  }
  out.ecom_geral = buildEcomGeralFallback();
  _cache = out;
  return out;
}

export function resolveVerticalFromTermo(termo: string | null | undefined): string | null {
  if (!termo) return null;
  const t = termo.toLowerCase().trim();
  const mapa = BENCHMARKS.mapeamento_subvertical?.mapa ?? {};
  for (const [keyword, vertical] of Object.entries(mapa)) {
    if (t.includes(keyword.toLowerCase())) return vertical;
  }
  return null;
}

export function nicheKeyToVertical(nicheKey: string): string {
  return NICHE_KEY_TO_VERTICAL[nicheKey] ?? "moda_acessorios";
}

function getMetricDef(nicheKey: string, metricJsonKey: string): MetricDef | null {
  const verticalKey = nicheKeyToVertical(nicheKey);
  const vertical = BENCHMARKS.verticais[verticalKey];
  return vertical?.metricas[metricJsonKey] ?? null;
}

export function referenciaIdeal(
  nicheKey: string,
  metricJsonKey: string = "roas",
): number | null {
  const def = getMetricDef(nicheKey, metricJsonKey);
  return def?.referencia_ideal ?? null;
}

export function referenceRoasIdeal(nicheKey: string): number {
  return referenciaIdeal(nicheKey, "roas") ?? referenciaIdeal("ecom_geral", "roas") ?? 5;
}

export function ticketMedioReferencia(nicheKey: string): number | null {
  const verticalKey = nicheKeyToVertical(nicheKey);
  const ticket = BENCHMARKS.verticais[verticalKey]?.ticket_medio_referencia;
  if (!ticket) return null;
  return Math.round((ticket.min + ticket.max) / 2);
}

export type StatusContext = {
  checkout_abs?: number;
  compras_abs?: number;
  impressions?: number;
};

export type CalcularStatusResult = {
  status: BenchmarkTier;
  label: string;
  cor: string;
  mensagem: string;
};

function formatValor(metricJsonKey: string, valor: number): string {
  if (metricJsonKey === "roas") return valor.toFixed(2).replace(".", ",") + "×";
  if (metricJsonKey === "cpm" || metricJsonKey === "cpp") {
    return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  }
  if (metricJsonKey.includes("taxa") || metricJsonKey === "ctr_conversao") {
    return valor.toFixed(1).replace(".", ",");
  }
  return valor.toFixed(2).replace(".", ",");
}

function interpolateMessage(
  template: string,
  metricJsonKey: string,
  valor: number,
  ref: number,
  ctx?: StatusContext,
): string {
  const pct = ref > 0 ? Math.round(Math.abs((valor - ref) / ref) * 100) : 0;
  const valorAbs =
    metricJsonKey === "ctr_conversao" && ctx?.impressions
      ? Math.round((valor / 100) * ctx.impressions)
      : Math.round(valor);
  return template
    .replace(/\{valor\}/g, formatValor(metricJsonKey, valor))
    .replace(/\{pct\}/g, String(pct))
    .replace(/\{valor_abs\}/g, String(valorAbs))
    .replace(/\{checkout_abs\}/g, String(ctx?.checkout_abs ?? "—"))
    .replace(/\{compras_abs\}/g, String(ctx?.compras_abs ?? "—"));
}

function classifyTierFromFaixas(
  valor: number,
  faixas: Record<string, FaixaDef>,
  higherIsBetter: boolean,
): BenchmarkTier {
  const tiered = faixasToTiered(faixas, higherIsBetter);
  const { ruim, atencao, bom, excelente } = tiered;
  if (higherIsBetter) {
    if (valor >= excelente) return "excelente";
    if (valor >= bom[0]) return "bom";
    if (valor >= atencao[0]) return "atencao";
    return "ruim";
  }
  if (valor <= excelente) return "excelente";
  if (valor <= bom[1]) return "bom";
  if (valor <= atencao[1]) return "atencao";
  return "ruim";
}

export function calcularStatus(params: {
  nicheKey: string;
  metricJsonKey: string;
  valor: number;
  contexto?: StatusContext;
}): CalcularStatusResult | null {
  const def = getMetricDef(params.nicheKey, params.metricJsonKey);
  if (!def) return null;
  const higherIsBetter = HIGHER_IS_BETTER_JSON.has(params.metricJsonKey);
  const status = classifyTierFromFaixas(params.valor, def.faixas, higherIsBetter);
  const faixa = def.faixas[status === "ruim" ? "ruim" : status === "atencao" ? "atencao" : status === "bom" ? "bom" : "excelente"];
  const ref = def.referencia_ideal;
  const template =
    status === "ruim" || status === "atencao"
      ? def.mensagem_ruim ?? `${def.label}: valor ${formatValor(params.metricJsonKey, params.valor)} fora da faixa saudável.`
      : def.mensagem_bom ?? `${def.label} na faixa ${status} para o nicho.`;
  return {
    status,
    label: faixa?.label ?? status,
    cor: faixa?.cor ?? "amber",
    mensagem: interpolateMessage(template, params.metricJsonKey, params.valor, ref, params.contexto),
  };
}

export function calcularGapFinanceiro(params: {
  spend: number;
  roasAtual: number;
  roasReferencia: number;
}): {
  receitaAtual: number;
  receitaPotencial: number;
  gapMensal: number;
  gapAnual: number;
} {
  const receitaAtual = params.spend * params.roasAtual;
  const receitaPotencial = params.spend * params.roasReferencia;
  const gapMensal = Math.max(0, Math.round(receitaPotencial - receitaAtual));
  return {
    receitaAtual,
    receitaPotencial,
    gapMensal,
    gapAnual: gapMensal * 12,
  };
}

export function calcularImpactoCheckout(params: {
  checkouts: number;
  comprasReais: number;
  taxaReferenciaPct: number;
  ticketMedioBrl: number;
}): {
  comprasPotenciais: number;
  comprasPerdidas: number;
  receitaPerdidaEstimada: number;
} {
  const taxa = params.taxaReferenciaPct / 100;
  const comprasPotenciais = params.checkouts * taxa;
  const comprasPerdidas = Math.max(0, comprasPotenciais - params.comprasReais);
  const receitaPerdidaEstimada = Math.round(comprasPerdidas * params.ticketMedioBrl);
  return {
    comprasPotenciais,
    comprasPerdidas,
    receitaPerdidaEstimada,
  };
}

export function benchmarkGapNote(
  nicheKey: string,
  metricJsonKey: string,
  valor: number,
  contexto?: StatusContext,
): string {
  const result = calcularStatus({ nicheKey, metricJsonKey, valor, contexto });
  return result?.mensagem ?? "";
}
