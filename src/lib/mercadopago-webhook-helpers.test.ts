import { describe, expect, it } from "vitest";
import {
  amountMatchesExpected,
  paymentAmountCents,
} from "./mercadopago-webhook-helpers";

describe("mercadopago-webhook-helpers", () => {
  it("converte transaction_amount para centavos", () => {
    expect(paymentAmountCents({ transaction_amount: 37 })).toBe(3700);
  });

  it("valida montante com tolerância de 1 centavo", () => {
    expect(amountMatchesExpected(3700, 3700)).toBe(true);
    expect(amountMatchesExpected(3701, 3700)).toBe(true);
    expect(amountMatchesExpected(3800, 3700)).toBe(false);
  });
});
