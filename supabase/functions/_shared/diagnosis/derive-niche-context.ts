import { NICHE_BENCHMARKS_V1 } from "./niche-benchmarks-v1.ts";

export type NicheSource = "business_context" | "heuristic" | "meta_vertical" | "default";

export type NicheContext = {
  nicheKey: string;
  nicheLabel: string;
  source: NicheSource;
  confidence: "high" | "medium" | "low";
};

function matchFromText(text: string): string | null {
  const t = text.toLowerCase();
  if (/(moda|roupa|vestu|calçad|sapato|acess[oó]rio|tricot|paprika|páprika)/.test(t)) {
    return "ecom_moda";
  }
  if (/(beleza|cosm[eé]tic|skincare|maquiagem)/.test(t)) return "ecom_beleza";
  if (/(casa|decora|móvel|mobili)/.test(t)) return "ecom_casa";
  if (/(eletr[oô]nic|tech|celular|gadget)/.test(t)) return "ecom_eletronicos";
  if (/(esporte|fitness|suplemento|academia)/.test(t)) return "ecom_esportes";
  if (/(aliment|bebida|comida|nutri)/.test(t)) return "ecom_alimentos";
  if (/(loja|ecom|e-?commerce|shop|marketplace)/.test(t)) return "ecom_geral";
  return null;
}

function matchMetaVertical(vertical: string): string | null {
  const v = vertical.toLowerCase();
  if (/apparel|fashion|clothing/.test(v)) return "ecom_moda";
  if (/beauty|cosmetic/.test(v)) return "ecom_beleza";
  if (/home|furniture/.test(v)) return "ecom_casa";
  if (/electronic|technology/.test(v)) return "ecom_eletronicos";
  if (/sport|fitness/.test(v)) return "ecom_esportes";
  if (/food|grocery/.test(v)) return "ecom_alimentos";
  if (/ecommerce|retail/.test(v)) return "ecom_geral";
  return null;
}

function heuristicFromCampaigns(facts: Record<string, unknown> | null | undefined): string | null {
  const campaigns = Array.isArray(facts?.campaigns_sample)
    ? (facts!.campaigns_sample as Record<string, unknown>[])
    : [];
  const names = campaigns.map((c) => String(c.name ?? "")).join(" ");
  const accountName = String(
    (facts?.account_meta as Record<string, unknown> | undefined)?.name ??
      (facts?.account_meta as Record<string, unknown> | undefined)?.business_name ??
      "",
  );
  return matchFromText(`${names} ${accountName}`);
}

export function resolveNicheContext(
  facts: Record<string, unknown> | null | undefined,
  businessContext?: Record<string, unknown> | null,
): NicheContext {
  const ctxNiche = businessContext?.niche ?? businessContext?.segment;
  if (ctxNiche && typeof ctxNiche === "string") {
    const key = matchFromText(ctxNiche);
    if (key && NICHE_BENCHMARKS_V1[key]) {
      return {
        nicheKey: key,
        nicheLabel: NICHE_BENCHMARKS_V1[key].label,
        source: "business_context",
        confidence: "high",
      };
    }
  }

  const heuristic = heuristicFromCampaigns(facts);
  if (heuristic && NICHE_BENCHMARKS_V1[heuristic]) {
    return {
      nicheKey: heuristic,
      nicheLabel: NICHE_BENCHMARKS_V1[heuristic].label,
      source: "heuristic",
      confidence: "medium",
    };
  }

  const vertical = String(
    (facts?.account_meta as Record<string, unknown> | undefined)?.vertical ?? "",
  );
  if (vertical) {
    const key = matchMetaVertical(vertical);
    if (key && NICHE_BENCHMARKS_V1[key]) {
      return {
        nicheKey: key,
        nicheLabel: NICHE_BENCHMARKS_V1[key].label,
        source: "meta_vertical",
        confidence: "medium",
      };
    }
  }

  return {
    nicheKey: "ecom_geral",
    nicheLabel: NICHE_BENCHMARKS_V1.ecom_geral.label,
    source: "default",
    confidence: "low",
  };
}
