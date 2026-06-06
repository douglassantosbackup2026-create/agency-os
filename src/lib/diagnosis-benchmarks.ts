// P5 — Benchmarks BR v2 — faixas "bom" alinhadas a benchmarks-br-v2.json (via servidor).

export type BenchmarkRange = [number, number];

export type BenchmarkTierKey = "ruim" | "atencao" | "bom" | "excelente";

export const BENCHMARK_TIER_LABELS: Record<BenchmarkTierKey, string> = {
  ruim: "Ruim",
  atencao: "Atenção",
  bom: "Bom",
  excelente: "Excelente",
};

export type NicheBenchmarks = {
  label: string;
  ranges: Partial<{
    roas: BenchmarkRange;
    ctr: BenchmarkRange;
    cpm: BenchmarkRange;
    cpc: BenchmarkRange;
    cpa: BenchmarkRange;
    frequencia: BenchmarkRange;
  }>;
};

/** Faixas "bom" do NICHE_BENCHMARKS_V1 (servidor). */
export const NICHE_BENCHMARKS: Record<string, NicheBenchmarks> = {
  ecom_moda: {
    label: "Moda e acessórios",
    ranges: { roas: [6, 9], ctr: [2, 4], cpm: [20, 40], frequencia: [2, 3] },
  },
  ecom_beleza: {
    label: "Beleza e cosméticos",
    ranges: { roas: [8, 12], ctr: [2.5, 5], cpm: [15, 30], frequencia: [2, 3] },
  },
  ecom_casa: {
    label: "Casa e decoração",
    ranges: { roas: [7, 10], ctr: [1.5, 3], cpm: [18, 35], frequencia: [2, 3] },
  },
  ecom_eletronicos: {
    label: "Eletrônicos e tecnologia",
    ranges: { roas: [10, 15], ctr: [1, 2], cpm: [20, 40], frequencia: [1.5, 2] },
  },
  ecom_esportes: {
    label: "Esportes e fitness",
    ranges: { roas: [7, 11], ctr: [2, 4], cpm: [14, 28], frequencia: [2, 3] },
  },
  ecom_alimentos: {
    label: "Alimentos, bebidas e suplementos",
    ranges: { roas: [10, 15], ctr: [2, 4], cpm: [12, 25], frequencia: [2, 3] },
  },
  ecom_geral: {
    label: "E-commerce geral",
    ranges: { roas: [5, 8], ctr: [2, 3.5], cpm: [18, 35], frequencia: [2, 3] },
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
  if (/(moda|roupa|vestu|calçad|sapato|acess[oó]rio|tricot|paprika|páprika)/.test(t)) {
    return "ecom_moda";
  }
  if (/(beleza|cosm[eé]tic|skincare|maquiagem)/.test(t)) return "ecom_beleza";
  if (/(casa|decora|móvel|mobili)/.test(t)) return "ecom_casa";
  if (/(eletr[oô]nic|tech|celular|gadget)/.test(t)) return "ecom_eletronicos";
  if (/(esporte|fitness|suplemento|academia)/.test(t)) return "ecom_esportes";
  if (/(aliment|bebida|comida|nutri)/.test(t)) return "ecom_alimentos";
  if (/(info\s*produto|curso|mentoria|ebook|treinamento|coach)/.test(t)) {
    return "infoproduto";
  }
  if (/(b2b|lead|saas|software|consultoria|empresa)/.test(t)) return "b2b";
  if (/(local|cl[ií]nica|barbearia|sal[aã]o|est[eé]tica|odonto|advog|imobili|restaurante)/.test(t)) {
    return "servico_local";
  }
  if (/(loja|ecom|e-?commerce|shop|marketplace)/.test(t)) return "ecom_geral";
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
  return `R$ ${a}–${b}`;
}
