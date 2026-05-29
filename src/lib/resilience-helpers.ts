/** Helpers testáveis para idempotência de webhook e orçamento IA. */

export function isWebhookDuplicateError(pgCode: string | undefined): boolean {
  return pgCode === "23505";
}

export function aiBudgetWouldExceed(
  usedTokens: number,
  estimatedTokens: number,
  maxTokensPerDay: number,
): boolean {
  return usedTokens + Math.max(estimatedTokens, 0) > maxTokensPerDay;
}

export function diagnosisBudgetWouldExceed(
  usedTokens: number,
  estimatedTokens: number,
  maxPerDay = 100_000,
): boolean {
  return aiBudgetWouldExceed(usedTokens, estimatedTokens, maxPerDay);
}
