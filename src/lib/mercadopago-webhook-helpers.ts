/** Espelho testável dos helpers em supabase/functions/_shared/mercadopago-webhook-helpers.ts */

export function paymentAmountCents(payment: Record<string, unknown>): number | null {
  const raw =
    payment.transaction_amount ??
    (payment.transaction_details as { transaction_amount?: number } | undefined)
      ?.transaction_amount;
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
