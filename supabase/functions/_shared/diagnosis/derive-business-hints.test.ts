import { describe, expect, it } from "vitest";
import { deriveBreakevenRoas, deriveBusinessHints } from "./derive-business-hints.ts";

describe("deriveBusinessHints", () => {
  it("calcula breakeven ROAS a partir da margem", () => {
    expect(deriveBreakevenRoas(30)).toBeCloseTo(3.33, 1);
    expect(deriveBreakevenRoas(null)).toBeNull();
  });

  it("monta marginNote com margem e ticket", () => {
    const hints = deriveBusinessHints({
      margin_pct: 25,
      avg_ticket_brl: 150,
    });
    expect(hints?.breakevenRoas).toBe(4);
    expect(hints?.marginNote).toMatch(/25%/);
    expect(hints?.marginNote).toMatch(/150/);
  });

  it("retorna null sem dados úteis", () => {
    expect(deriveBusinessHints({})).toBeNull();
  });
});
