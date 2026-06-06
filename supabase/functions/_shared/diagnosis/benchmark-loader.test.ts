import { describe, expect, it } from "vitest";
import {
  calcularGapFinanceiro,
  calcularImpactoCheckout,
  calcularStatus,
  getNicheBenchmarksV1,
  referenceRoasIdeal,
  referenciaIdeal,
  resolveVerticalFromTermo,
} from "./benchmark-loader.ts";

describe("benchmark-loader v2", () => {
  it("carrega verticais com tiers moda", () => {
    const all = getNicheBenchmarksV1();
    expect(all.ecom_moda?.roas?.bom).toEqual([6, 9]);
    expect(all.ecom_moda?.ctrConversion?.bom).toEqual([2, 4]);
    expect(all.ecom_geral).toBeDefined();
  });

  it("referencia ideal moda ROAS 7,5×", () => {
    expect(referenciaIdeal("ecom_moda", "roas")).toBe(7.5);
    expect(referenceRoasIdeal("ecom_moda")).toBe(7.5);
  });

  it("resolveVerticalFromTermo mapeia moda", () => {
    expect(resolveVerticalFromTermo("moda feminina")).toBe("moda_acessorios");
    expect(resolveVerticalFromTermo("whey protein")).toBe("alimentos_suplementos");
  });

  it("calcularStatus ROAS 4,95 moda → atencao com mensagem consultiva", () => {
    const r = calcularStatus({
      nicheKey: "ecom_moda",
      metricJsonKey: "roas",
      valor: 4.95,
    });
    expect(r?.status).toBe("atencao");
    expect(r?.label).toBe("Atenção");
    expect(r?.mensagem).toMatch(/4,95×|moda/i);
  });

  it("calcularStatus CTR 2,93 moda → bom", () => {
    const r = calcularStatus({
      nicheKey: "ecom_moda",
      metricJsonKey: "ctr_conversao",
      valor: 2.93,
      contexto: { impressions: 150000 },
    });
    expect(r?.status).toBe("bom");
  });

  it("calcularGapFinanceiro moda exemplo", () => {
    const g = calcularGapFinanceiro({
      spend: 9092,
      roasAtual: 4.95,
      roasReferencia: 7.5,
    });
    expect(g.gapMensal).toBeGreaterThan(20000);
    expect(g.gapAnual).toBe(g.gapMensal * 12);
  });

  it("calcularImpactoCheckout Paprika-like", () => {
    const impact = calcularImpactoCheckout({
      checkouts: 138,
      comprasReais: 30,
      taxaReferenciaPct: 55,
      ticketMedioBrl: 200,
    });
    expect(impact.comprasPerdidas).toBeGreaterThan(40);
    expect(impact.receitaPerdidaEstimada).toBeGreaterThan(8000);
  });
});
