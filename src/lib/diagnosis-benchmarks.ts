// P5 — Benchmarks de referência por nicho.
// Faixas indicativas, baseadas em medianas observadas em contas pequenas/médias
// no Brasil. Servem como contexto — não substituem a meta da operação.

export type BenchmarkRange = [number, number];

export type NicheBenchmarks = {
  label: string;
  // chaves correspondem a métricas do relatório (case-insensitive contains).
  ranges: Partial<{
    roas: BenchmarkRange;
    ctr: BenchmarkRange; // em %
    cpm: BenchmarkRange; // em R$
    cpc: BenchmarkRange; // em R$
    cpa: BenchmarkRange; // em R$
    frequencia: BenchmarkRange;
  }>;
};

export const NICHE_BENCHMARKS: Record<string, NicheBenchmarks> = {
  ecom_moda: {
    label: "E-commerce de moda",
    ranges: {
      roas: [2.0, 4.0],
      ctr: [1.2, 2.2],
      cpm: [15, 35],
      cpc: [0.6, 1.8],
      frequencia: [1.5, 3.0],
    },
  },
  ecom_geral: {
    label: "E-commerce geral",
    ranges: {
      roas: [2.5, 5.0],
      ctr: [1.0, 2.0],
      cpm: [18, 40],
      cpc: [0.8, 2.2],
      frequencia: [1.5, 3.0],
    },
  },
  infoproduto: {
    label: "Infoproduto / curso",
    ranges: {
      roas: [2.0, 4.0],
      ctr: [1.5, 3.0],
      cpm: [12, 28],
      cpc: [0.5, 1.5],
      cpa: [25, 80],
      frequencia: [1.5, 2.8],
    },
  },
  servico_local: {
    label: "Serviço local",
    ranges: {
      roas: [3.0, 6.0],
      ctr: [1.0, 2.0],
      cpm: [10, 25],
      cpa: [15, 60],
      frequencia: [1.5, 3.0],
    },
  },
  b2b: {
    label: "B2B / lead gen",
    ranges: {
      ctr: [0.8, 1.8],
      cpm: [20, 50],
      cpc: [1.5, 5.0],
      cpa: [50, 200],
      frequencia: [1.5, 3.0],
    },
  },
};

/** Match heurístico do texto livre do usuário para uma chave de benchmark. */
export function matchNicheKey(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/(moda|roupa|vestu|calçad|sapato|acess[oó]rio)/.test(t)) return "ecom_moda";
  if (/(info\s*produto|curso|mentoria|ebook|treinamento|coach)/.test(t))
    return "infoproduto";
  if (/(b2b|lead|saas|software|consultoria|empresa)/.test(t)) return "b2b";
  if (/(local|cl[ií]nica|barbearia|sal[aã]o|est[eé]tica|odonto|advog|imobili|restaurante)/.test(t))
    return "servico_local";
  if (/(loja|ecom|e-?commerce|shop|marketplace|cosm[eé]tic|beleza|suplement)/.test(t))
    return "ecom_geral";
  return null;
}

/** Tenta casar um nome de métrica do relatório com uma chave do benchmark. */
export function matchMetricKey(name: string): keyof NicheBenchmarks["ranges"] | null {
  const n = name.toLowerCase();
  if (/roas/.test(n)) return "roas";
  if (/ctr/.test(n)) return "ctr";
  if (/cpm/.test(n)) return "cpm";
  if (/cpc/.test(n)) return "cpc";
  if (/cpa|custo por (aquisi|convers|venda|lead)/.test(n)) return "cpa";
  if (/frequ/.test(n)) return "frequencia";
  return null;
}

export function formatBenchmark(
  key: keyof NicheBenchmarks["ranges"],
  range: BenchmarkRange,
): string {
  const [a, b] = range;
  if (key === "ctr") return `${a.toFixed(1)}–${b.toFixed(1)}%`;
  if (key === "roas" || key === "frequencia")
    return `${a.toFixed(1)}–${b.toFixed(1)}`;
  // moeda
  return `R$ ${a}–${b}`;
}
