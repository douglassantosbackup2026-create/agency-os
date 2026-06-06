import { describe, expect, it } from "vitest";
import { resolveRoasTarget } from "./derive-roas-target.ts";

describe("resolveRoasTarget", () => {
  it("prioriza target_roas declarado", () => {
    const r = resolveRoasTarget({ target_roas: 10, margin_pct: 30 }, "ecom_moda");
    expect(r.target).toBe(10);
    expect(r.source).toBe("declared");
  });

  it("usa breakeven quando sem target declarado", () => {
    const r = resolveRoasTarget({ margin_pct: 25 }, "ecom_moda");
    expect(r.source).toBe("breakeven");
    expect(r.target).toBeCloseTo(4, 0);
  });

  it("fallback para referencia ideal do nicho", () => {
    const r = resolveRoasTarget(null, "ecom_moda");
    expect(r.source).toBe("niche");
    expect(r.target).toBe(7.5);
  });
});
