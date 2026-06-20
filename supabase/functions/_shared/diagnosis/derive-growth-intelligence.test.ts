import { describe, expect, it } from "vitest";
import paprika from "./__fixtures__/paprika-account.json";
import { attachCommercialToFacts, buildFactsEnrichment } from "./derive-analysis.ts";
import type { GrowthIntelligenceDerived } from "./derive-growth-intelligence.ts";

function enrichPaprikaFacts(): Record<string, unknown> {
  const raw = paprika as Record<string, unknown>;
  const campaigns = raw.campaigns_sample as Record<string, unknown>[];
  const insights = raw.campaigns_insights as Record<string, unknown>[];
  const { campaigns_enriched, objective_spend_mix } = buildFactsEnrichment(
    campaigns,
    insights,
  );
  return {
    ...raw,
    campaigns_enriched,
    objective_spend_mix,
  };
}

describe("Growth Intelligence v3", () => {
  it("builds growth_intelligence_derived with 8 motores", () => {
    const facts = attachCommercialToFacts(enrichPaprikaFacts());
    const gi = facts.growth_intelligence_derived as GrowthIntelligenceDerived;
    expect(gi).toBeDefined();
    expect(gi.executiveImpact.investedFormatted).toContain("R$");
    expect(gi.maturity.score0to100).toBeGreaterThanOrEqual(0);
    expect(gi.maturity.score0to100).toBeLessThanOrEqual(100);
    expect(gi.maturity.enterpriseLabel).toBeTruthy();
    expect(Array.isArray(gi.moneyLeaks)).toBe(true);
    expect(Array.isArray(gi.benchmarkImpacts)).toBe(true);
    expect(gi.projections.scenarios.length).toBe(3);
  });

  it("não emite múltiplos vazamentos com a mesma frase-template 'abaixo do ROAS do nicho'", () => {
    const facts = attachCommercialToFacts(enrichPaprikaFacts());
    const gi = facts.growth_intelligence_derived as GrowthIntelligenceDerived;
    const titles = gi.moneyLeaks.map((l) => l.title);
    const matches = titles.filter((t) => /abaixo do ROAS do nicho/i.test(t));
    // No máximo 1 entrada agregada ("Outros conjuntos…").
    expect(matches.length).toBeLessThanOrEqual(1);
  });

  it("top 3 vazamentos cobrem pelo menos 2 categorias quando há diversidade disponível", () => {
    const facts = attachCommercialToFacts(enrichPaprikaFacts());
    const gi = facts.growth_intelligence_derived as GrowthIntelligenceDerived;
    if (gi.moneyLeaks.length < 3) return;
    const allCats = new Set(gi.moneyLeaks.map((l) => l.category));
    if (allCats.size < 2) return;
    const top3Cats = new Set(gi.moneyLeaks.slice(0, 3).map((l) => l.category));
    expect(top3Cats.size).toBeGreaterThanOrEqual(2);
  });

  it("soma dos vazamentos reconcilia com o gap do executiveImpact", () => {
    const facts = attachCommercialToFacts(enrichPaprikaFacts());
    const gi = facts.growth_intelligence_derived as GrowthIntelligenceDerived;
    const sum = gi.moneyLeaks.reduce((s, l) => s + l.monthlyImpactBrl, 0);
    const gap = gi.executiveImpact.gapMonthlyBrl;
    // Permitimos sum >= gap (decomposição pode somar acima), mas nunca gap muito acima da soma.
    expect(sum + 100).toBeGreaterThanOrEqual(gap);
  });
});

import { deriveFunnelAnalysis } from "./derive-analysis.ts";

function makeFunnelFacts(opts: {
  lpv: number;
  atc: number;
  checkout: number;
  paymentInfo: number;
  purchase: number;
}): Record<string, unknown> {
  const actions = [
    { action_type: "landing_page_view", value: String(opts.lpv) },
    { action_type: "add_to_cart", value: String(opts.atc) },
    { action_type: "initiate_checkout", value: String(opts.checkout) },
    ...(opts.paymentInfo > 0
      ? [{ action_type: "add_payment_info", value: String(opts.paymentInfo) }]
      : []),
    { action_type: "purchase", value: String(opts.purchase) },
  ];
  return {
    campaigns_enriched: [
      { campaign_id: "c1", family: "sales", spend: 1000, roas: 2 },
    ],
    campaigns_insights: [
      {
        campaign_id: "c1",
        actions,
        action_values: [{ action_type: "purchase", value: String(opts.purchase * 200) }],
      },
    ],
    business_context: { avg_ticket_brl: 200 },
  };
}

describe("Funnel sub-bottlenecks (add_payment_info)", () => {
  it("detecta checkout_late quando paymentInfo alto e purchase baixo", () => {
    const f = deriveFunnelAnalysis(
      makeFunnelFacts({ lpv: 5000, atc: 800, checkout: 300, paymentInfo: 250, purchase: 60 }),
    );
    expect(f?.bottleneck).toBe("checkout_late");
    expect(f?.paymentInfoTracked).toBe(true);
    expect((f?.revenueAtRiskMonthlyBrl ?? 0)).toBeGreaterThan(0);
  });

  it("detecta checkout_early quando paymentInfo é baixo em relação ao checkout", () => {
    const f = deriveFunnelAnalysis(
      makeFunnelFacts({ lpv: 5000, atc: 800, checkout: 400, paymentInfo: 80, purchase: 40 }),
    );
    expect(f?.bottleneck).toBe("checkout_early");
    expect((f?.paymentInfoRate ?? 100)).toBeLessThan(60);
  });

  it("usa fallback 'checkout' quando add_payment_info não está rastreado", () => {
    const f = deriveFunnelAnalysis(
      makeFunnelFacts({ lpv: 5000, atc: 800, checkout: 300, paymentInfo: 0, purchase: 60 }),
    );
    expect(f?.bottleneck).toBe("checkout");
    expect(f?.paymentInfoTracked).toBe(false);
    expect(f?.bottleneckDetail).toMatch(/add_payment_info/);
  });

  it("não marca gargalo quando ambas as taxas pós-checkout estão saudáveis", () => {
    const f = deriveFunnelAnalysis(
      makeFunnelFacts({ lpv: 5000, atc: 800, checkout: 300, paymentInfo: 250, purchase: 200 }),
    );
    expect(f?.bottleneck).not.toBe("checkout_late");
    expect(f?.bottleneck).not.toBe("checkout_early");
  });
});

import { evidenceStrengthFromPurchases } from "./derive-growth-intelligence.ts";
import { classifyTrend } from "./derive-trends.ts";

describe("evidenceStrengthFromPurchases (Item 1 — confiança estatística)", () => {
  it("classifica <10 compras como low", () => {
    expect(evidenceStrengthFromPurchases(3).tier).toBe("low");
    expect(evidenceStrengthFromPurchases(9).tier).toBe("low");
  });
  it("classifica 10–29 compras como medium", () => {
    expect(evidenceStrengthFromPurchases(10).tier).toBe("medium");
    expect(evidenceStrengthFromPurchases(29).tier).toBe("medium");
  });
  it("classifica ≥30 compras como high", () => {
    expect(evidenceStrengthFromPurchases(30).tier).toBe("high");
    expect(evidenceStrengthFromPurchases(120).tier).toBe("high");
  });
});

describe("classifyTrend (Item 2 — tendência temporal)", () => {
  it("ROAS caindo ≥15% → deteriorating", () => {
    const r = classifyTrend("roas", 5, 7);
    expect(r.direction).toBe("deteriorating");
    expect(r.deltaPct).toBeLessThan(0);
  });
  it("ROAS subindo ≥15% → improving", () => {
    expect(classifyTrend("roas", 7, 5).direction).toBe("improving");
  });
  it("variação <15% → stable", () => {
    expect(classifyTrend("roas", 5.3, 5).direction).toBe("stable");
  });
  it("CPA subindo é deteriorating (métrica ruim)", () => {
    expect(classifyTrend("cpa", 100, 70).direction).toBe("deteriorating");
  });
  it("CPA caindo é improving (métrica ruim invertida)", () => {
    expect(classifyTrend("cpa", 60, 100).direction).toBe("improving");
  });
  it("previous=0 ou null → unknown", () => {
    expect(classifyTrend("roas", 5, 0).direction).toBe("unknown");
    expect(classifyTrend("roas", null, 5).direction).toBe("unknown");
  });
});

describe("Ad-bleed leak (Item 1 integração)", () => {
  it("criativo de alto spend e 0 compras vira leak 'low' sem imperativo de escala", () => {
    const facts: Record<string, unknown> = {
      campaigns_enriched: [{ campaign_id: "c1", family: "sales", spend: 1000, roas: 1 }],
      campaigns_insights: [
        { campaign_id: "c1", actions: [{ action_type: "purchase", value: "5" }] },
      ],
      ads_insights_top: [
        {
          ad_id: "a1",
          ad_name: "Mantas — vídeo",
          campaign_name: "Vendas",
          spend: 400,
          actions: [],
          action_values: [],
          ctr: 1.0,
        },
      ],
    };
    attachCommercialToFacts(facts);
    const gi = facts.growth_intelligence_derived as GrowthIntelligenceDerived;
    const adLeak = gi.moneyLeaks.find((l) => l.id.startsWith("ad-bleed:"));
    expect(adLeak).toBeDefined();
    expect(adLeak?.evidenceStrength?.tier).toBe("low");
    expect(adLeak?.confidence).toBe("low");
    expect(adLeak?.action).toMatch(/Sinal inicial|validar/i);
  });
});



