/** Validação de montante MP vs diagnóstico (centavos). Tolerância 1 centavo. */

export function paymentAmountCents(payment: Record<string, unknown>): number | null {
  const raw =
    payment.transaction_amount ??
    payment.transaction_details?.transaction_amount;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.round(raw * 100);
  }
  return null;
}

export function amountMatchesExpected(
  paidCents: number | null,
  expectedCents: number,
): boolean {
  if (paidCents === null || !Number.isFinite(expectedCents)) return false;
  return Math.abs(paidCents - expectedCents) <= 1;
}

export function managementPriceCentsFromEnv(): number {
  const n = parseInt(Deno.env.get("MANAGEMENT_PRICE_CENTS") ?? "199700", 10);
  return Number.isFinite(n) && n > 0 ? n : 199700;
}
