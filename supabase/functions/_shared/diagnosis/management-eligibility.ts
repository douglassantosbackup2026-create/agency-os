/** CTA de gestão: só para contas com gasto Meta ≥ R$ 5k nos últimos 30 dias. */

export const MANAGEMENT_MIN_SPEND_BRL = 5000;

export function parseSpendFromFacts(facts: unknown): number | null {
  if (!facts || typeof facts !== "object") return null;
  const ins = (facts as Record<string, unknown>).account_insights;
  if (!ins || typeof ins !== "object") return null;
  const raw = (ins as Record<string, unknown>).spend;
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function isManagementCtaEligible(facts: unknown): boolean {
  const spend = parseSpendFromFacts(facts);
  return spend !== null && spend >= MANAGEMENT_MIN_SPEND_BRL;
}
