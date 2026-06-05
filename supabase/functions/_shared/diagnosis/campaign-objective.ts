/**
 * Diagnóstico Meta: mapa objective API → família UI + KPI por campanha.
 * Fonte de verdade: campaign.objective (Graph API), não nomenclatura do nome.
 */

export type DerivedStatus =
  | "bom"
  | "atenção"
  | "alerta"
  | "sem tracking"
  | "sem dados";

export type ObjectiveFamily =
  | "sales"
  | "traffic"
  | "awareness"
  | "leads"
  | "engagement"
  | "app"
  | "other";

export type PrimaryResultKind =
  | "purchase"
  | "reach"
  | "impressions"
  | "link_click"
  | "landing_page_view"
  | "lead"
  | "post_engagement"
  | "video_view"
  | "app_install"
  | "other";

export type CampaignEnriched = {
  campaign_id: string;
  name: string;
  status: string;
  objective_raw: string;
  family: ObjectiveFamily;
  family_label_pt: string;
  /** "meta" quando objective veio do Graph API; "inferred" quando deduzido por sinais (action_values, actions). */
  objective_source?: "meta" | "inferred";
  spend: number;
  impressions: number;
  reach: number | null;
  frequency: number | null;
  ctr_link: number | null;
  cpc_link: number | null;
  cpm: number | null;
  primary_result: {
    kind: PrimaryResultKind;
    label_pt: string;
    count: number;
    cost_per_result: number | null;
  };
  roas: number | null;
  kpi_status: DerivedStatus;
  kpi_status_reason: string;
};

/**
 * Quando a API Meta omite `objective` (campo em branco / token sem ads_management completo),
 * inferimos a family a partir de sinais nos insights:
 *   - presença de purchase em action_values com valor > 0 → "sales"
 *   - presença de lead em actions com count > 0 → "leads"
 * Não usamos o nome da campanha (regra explícita do prompt).
 */
export function inferFamilyFromSignals(
  actions: unknown,
  actionValues: unknown,
): ObjectiveFamily | null {
  if (Array.isArray(actionValues)) {
    const purchaseHit = actionValues.find((a) => {
      const t = (a as ActionRow).action_type ?? "";
      const v = num((a as ActionRow).value) ?? 0;
      return v > 0 && /^(omni_)?purchase$|offsite_conversion\.fb_pixel_purchase|onsite_web(_app)?_purchase/i.test(t);
    });
    if (purchaseHit) return "sales";
  }
  if (Array.isArray(actions)) {
    const leadHit = actions.find((a) => {
      const t = (a as ActionRow).action_type ?? "";
      const v = num((a as ActionRow).value) ?? 0;
      return v > 0 && /^lead$|onsite_conversion\.lead_grouped|offsite_conversion\.fb_pixel_lead/i.test(t);
    });
    if (leadHit) return "leads";
  }
  return null;
}

export function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
}

export function mapObjectiveToFamily(raw: string): ObjectiveFamily {
  const u = (raw ?? "").toUpperCase().trim();
  if (
    u.includes("SALES") ||
    u === "CONVERSIONS" ||
    u.includes("PRODUCT_CATALOG")
  ) {
    return "sales";
  }
  if (u.includes("TRAFFIC") || u === "LINK_CLICKS") return "traffic";
  if (
    u.includes("AWARENESS") ||
    u === "REACH" ||
    u.includes("BRAND_AWARENESS")
  ) {
    return "awareness";
  }
  if (u.includes("LEAD")) return "leads";
  if (
    u.includes("ENGAGEMENT") ||
    u.includes("VIDEO") ||
    u === "POST_ENGAGEMENT"
  ) {
    return "engagement";
  }
  if (u.includes("APP")) return "app";
  return "other";
}

export function labelFamilyPt(family: ObjectiveFamily): string {
  const labels: Record<ObjectiveFamily, string> = {
    sales: "Vendas",
    traffic: "Tráfego",
    awareness: "Reconhecimento",
    leads: "Leads",
    engagement: "Engajamento",
    app: "Promoção do app",
    other: "Outro",
  };
  return labels[family];
}

type ActionRow = { action_type?: string; value?: string };
type CostRow = { action_type?: string; value?: string };

function findActionCount(
  actions: unknown,
  patterns: RegExp[],
): { count: number; kind: PrimaryResultKind; label: string } | null {
  if (!Array.isArray(actions)) return null;
  for (const pat of patterns) {
    const hit = actions.find((a) => {
      const t = (a as ActionRow).action_type ?? "";
      return pat.test(t);
    }) as ActionRow | undefined;
    if (hit) {
      const count = num(hit.value) ?? 0;
      if (count > 0) {
        const t = hit.action_type ?? "";
        let kind: PrimaryResultKind = "other";
        if (/purchase|omni_purchase/i.test(t)) kind = "purchase";
        else if (/reach/i.test(t)) kind = "reach";
        else if (/impression/i.test(t)) kind = "impressions";
        else if (/landing_page_view/i.test(t)) kind = "landing_page_view";
        else if (/link_click|inline_link/i.test(t)) kind = "link_click";
        else if (/lead/i.test(t)) kind = "lead";
        else if (/post_engagement|page_engagement/i.test(t)) kind =
          "post_engagement";
        else if (/video_view/i.test(t)) kind = "video_view";
        else if (/app_install/i.test(t)) kind = "app_install";
        return { count, kind, label: actionLabelPt(kind) };
      }
    }
  }
  return null;
}

function findCostPerAction(
  costPer: unknown,
  patterns: RegExp[],
): number | null {
  if (!Array.isArray(costPer)) return null;
  for (const pat of patterns) {
    const hit = costPer.find((c) => {
      const t = (c as CostRow).action_type ?? "";
      return pat.test(t);
    }) as CostRow | undefined;
    if (hit) {
      const v = num(hit.value);
      if (v != null && v > 0) return v;
    }
  }
  return null;
}

function actionLabelPt(kind: PrimaryResultKind): string {
  const m: Record<PrimaryResultKind, string> = {
    purchase: "Compras no site",
    reach: "Alcance",
    impressions: "Impressões",
    link_click: "Cliques no link",
    landing_page_view: "Visualizações da página de destino",
    lead: "Leads",
    post_engagement: "Engajamento",
    video_view: "Visualizações de vídeo",
    app_install: "Instalações do app",
    other: "Resultados",
  };
  return m[kind];
}

const FAMILY_ACTION_PATTERNS: Record<
  ObjectiveFamily,
  { patterns: RegExp[]; fallbackKind: PrimaryResultKind }
> = {
  sales: {
    patterns: [
      /^purchase$/i,
      /^omni_purchase$/i,
      /offsite_conversion\.fb_pixel_purchase/i,
    ],
    fallbackKind: "purchase",
  },
  traffic: {
    patterns: [/landing_page_view/i, /link_click/i, /inline_link_click/i],
    fallbackKind: "landing_page_view",
  },
  awareness: {
    patterns: [/^reach$/i, /^impressions$/i],
    fallbackKind: "reach",
  },
  leads: {
    patterns: [/^lead$/i, /lead_grouped/i, /onsite_conversion\.lead/i],
    fallbackKind: "lead",
  },
  engagement: {
    patterns: [/post_engagement/i, /page_engagement/i, /video_view/i],
    fallbackKind: "post_engagement",
  },
  app: {
    patterns: [/app_install/i, /mobile_app_install/i],
    fallbackKind: "app_install",
  },
  other: {
    patterns: [/.*/],
    fallbackKind: "other",
  },
};

export function pickPrimaryResult(
  family: ObjectiveFamily,
  spend: number,
  actions: unknown,
  costPerActionType: unknown,
): CampaignEnriched["primary_result"] {
  const cfg = FAMILY_ACTION_PATTERNS[family];
  const found = findActionCount(actions, cfg.patterns);
  let count = found?.count ?? 0;
  let kind = found?.kind ?? cfg.fallbackKind;
  let label = found?.label ?? actionLabelPt(kind);

  if (count === 0 && family === "awareness") {
    const reach = findActionCount(actions, [/^reach$/i]);
    if (reach) {
      count = reach.count;
      kind = "reach";
      label = reach.label;
    }
  }

  let cost = findCostPerAction(costPerActionType, cfg.patterns);
  if (cost == null && count > 0 && spend > 0) {
    if (family === "awareness" && kind === "reach") {
      cost = (spend / count) * 1000;
      label = "Alcance";
    } else {
      cost = spend / count;
    }
  }

  return {
    kind,
    label_pt: label,
    count,
    cost_per_result: cost,
  };
}

export function computeRoas(
  actionValues: unknown,
  spend: number,
): number | null {
  if (spend <= 0 || !Array.isArray(actionValues)) return null;
  const hit = actionValues.find((a) => {
    const t = (a as ActionRow).action_type ?? "";
    return /^purchase$|^omni_purchase$/i.test(t);
  }) as ActionRow | undefined;
  const revenue = hit ? num(hit.value) : null;
  if (revenue == null || revenue <= 0) return null;
  return revenue / spend;
}

export function scoreCampaignKpi(c: {
  family: ObjectiveFamily;
  spend: number;
  roas: number | null;
  primary_result: CampaignEnriched["primary_result"];
  ctr_link: number | null;
  cpc_link: number | null;
  cpm: number | null;
  frequency: number | null;
  roasTarget?: number;
}): { status: DerivedStatus; reason: string } {
  const { family, roas, primary_result: pr, ctr_link, cpc_link, cpm, frequency } =
    c;
  const target = c.roasTarget ?? 3;

  if (family === "sales") {
    if (roas == null) {
      return {
        status: "sem tracking",
        reason: "Sem receita de compra rastreada (ROAS não aplicável sem pixel de compra).",
      };
    }
    if (roas >= target) {
      return { status: "bom", reason: `ROAS ${roas.toFixed(2)}x (meta ${target.toFixed(1)}x).` };
    }
    if (roas >= target * 0.45) {
      return {
        status: "atenção",
        reason: `ROAS ${roas.toFixed(2)}x abaixo da meta (${target.toFixed(1)}x).`,
      };
    }
    return {
      status: "alerta",
      reason: `ROAS ${roas.toFixed(2)}x — eficiência de venda comprometida (meta ${target.toFixed(1)}x).`,
    };
  }

  if (family === "traffic") {
    const cpr = pr.cost_per_result;
    if (cpr != null && cpr <= 0.2) {
      return {
        status: "bom",
        reason: `Custo por ${pr.label_pt.toLowerCase()} eficiente (${cpr.toFixed(2)}).`,
      };
    }
    if (ctr_link != null && ctr_link >= 1.2) {
      return { status: "bom", reason: `CTR link ${ctr_link.toFixed(2)}% saudável.` };
    }
    if (cpr != null && cpr <= 0.5) {
      return { status: "atenção", reason: `Custo por resultado moderado.` };
    }
    if (ctr_link != null && ctr_link >= 0.5) {
      return { status: "atenção", reason: `CTR link ${ctr_link.toFixed(2)}%.` };
    }
    return {
      status: "alerta",
      reason: `Custo ou CTR de tráfego abaixo do esperado para campanhas de destino.`,
    };
  }

  if (family === "awareness") {
    const cpmVal = cpm ?? null;
    const cpr1k = pr.cost_per_result;
    if (cpr1k != null && cpr1k <= 5) {
      return {
        status: "bom",
        reason: `Custo por 1.000 pessoas alcançadas ~ R$ ${cpr1k.toFixed(2)}.`,
      };
    }
    if (cpmVal != null && cpmVal <= 25) {
      return { status: "bom", reason: `CPM R$ ${cpmVal.toFixed(2)} eficiente.` };
    }
    if (cpr1k != null && cpr1k <= 15) {
      return { status: "atenção", reason: `Custo por alcance moderado.` };
    }
    if (frequency != null && frequency > 5) {
      return {
        status: "alerta",
        reason: `Frequência ${frequency.toFixed(1)} — possível saturação de alcance.`,
      };
    }
    return {
      status: "atenção",
      reason: `Avaliado por alcance/CPM (ROAS não se aplica a este objetivo).`,
    };
  }

  if (family === "leads") {
    const cpl = pr.cost_per_result;
    if (cpl != null && cpl <= 40) {
      return { status: "bom", reason: `Custo por lead R$ ${cpl.toFixed(2)}.` };
    }
    if (cpl != null && cpl <= 80) {
      return { status: "atenção", reason: `Custo por lead R$ ${cpl.toFixed(2)}.` };
    }
    if (pr.count === 0) {
      return { status: "sem dados", reason: "Sem leads registrados no período." };
    }
    return {
      status: "alerta",
      reason: `Custo por lead elevado (R$ ${cpl?.toFixed(2) ?? "—"}).`,
    };
  }

  if (family === "engagement" || family === "app") {
    const cpr = pr.cost_per_result;
    if (cpr != null && cpr <= 1) {
      return { status: "bom", reason: `Custo por ${pr.label_pt.toLowerCase()} baixo.` };
    }
    if (pr.count > 0) {
      return {
        status: "atenção",
        reason: `Avaliado por ${pr.label_pt} (sem ROAS de compra).`,
      };
    }
    return { status: "sem dados", reason: "Poucos resultados no período." };
  }

  return {
    status: "sem dados",
    reason: "Objetivo não mapeado — verifique no Gerenciador de Anúncios.",
  };
}

export function enrichCampaigns(
  sample: Record<string, unknown>[],
  insights: Record<string, unknown>[],
): CampaignEnriched[] {
  const metaById = new Map<string, Record<string, unknown>>();
  for (const c of sample) {
    const id = String(c.id ?? "");
    if (id) metaById.set(id, c);
  }

  const out: CampaignEnriched[] = [];
  for (const ins of insights) {
    const campaign_id = String(ins.campaign_id ?? "");
    if (!campaign_id) continue;
    const spend = num(ins.spend) ?? 0;
    if (spend <= 0) continue;

    const meta = metaById.get(campaign_id);
    const objective_raw = String(meta?.objective ?? "UNKNOWN");
    const actions = ins.actions;
    const action_values = ins.action_values;
    const cost_per_action_type = ins.cost_per_action_type;

    let family = mapObjectiveToFamily(objective_raw);
    let objective_source: "meta" | "inferred" =
      objective_raw && objective_raw !== "UNKNOWN" ? "meta" : "inferred";
    // Fallback: API Meta às vezes omite `objective` (token sem ads_management completo
    // ou campanhas ODAX migradas). Sem isto a campanha vira family="other" e a receita
    // é descartada apesar de haver purchase em action_values.
    if (family === "other") {
      const inferred = inferFamilyFromSignals(actions, action_values);
      if (inferred) {
        family = inferred;
        objective_source = "inferred";
      }
    }

    const ctr_link =
      num(ins.inline_link_click_ctr) ?? num(ins.ctr);
    const cpc_link =
      num(ins.cost_per_inline_link_click) ?? num(ins.cpc);

    const primary_result = pickPrimaryResult(
      family,
      spend,
      actions,
      cost_per_action_type,
    );
    const roas =
      family === "sales" ? computeRoas(action_values, spend) : null;
    const { status, reason } = scoreCampaignKpi({
      family,
      spend,
      roas,
      primary_result,
      ctr_link,
      cpc_link,
      cpm: num(ins.cpm),
      frequency: num(ins.frequency),
    });

    const finalReason =
      objective_source === "inferred" && family !== "other"
        ? `Objetivo ausente na API Meta — classificada como ${labelFamilyPt(family)} por sinais nos insights (${family === "sales" ? "purchase em action_values" : "leads em actions"}).`
        : reason;

    out.push({
      campaign_id,
      name: String(ins.campaign_name ?? meta?.name ?? campaign_id),
      status: String(meta?.effective_status ?? meta?.status ?? "—"),
      objective_raw,
      family,
      family_label_pt: labelFamilyPt(family),
      objective_source,
      spend,
      impressions: num(ins.impressions) ?? 0,
      reach: num(ins.reach),
      frequency: num(ins.frequency),
      ctr_link,
      cpc_link,
      cpm: num(ins.cpm),
      primary_result,
      roas,
      kpi_status: status,
      kpi_status_reason: finalReason,
    });
  }

  out.sort((a, b) => b.spend - a.spend);
  return out;
}

export function computeSpendMix(
  enriched: CampaignEnriched[],
): Record<string, number> {
  const total = enriched.reduce((s, c) => s + c.spend, 0);
  if (total <= 0) return {};
  const acc: Record<string, number> = {};
  for (const c of enriched) {
    acc[c.family] = (acc[c.family] ?? 0) + c.spend / total;
  }
  return acc;
}
