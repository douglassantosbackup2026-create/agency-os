/**
 * Simulação leve (v1 conservadora): impacto linear aproximado ao reduzir/pausar
 * parte do volume de investimento — para briefing humano, não automação na rede.
 */

/** Dias restantes na semana (seg→dom), incluindo hoje. */
export function calendarDaysLeftThisWeek(): number {
  const day = new Date().getDay();
  const mon0Sun6 = day === 0 ? 6 : day - 1;
  return 7 - mon0Sun6;
}

export type LinearPauseHint = {
  approxSaved: number;
  avgDailySpend: number;
  pauseFraction: number;
  daysRemaining: number;
};

/**
 * `spendLast7Days`: soma de spend dos últimos 7 dias agregados ao cliente.
 * `pauseFraction`: fração do volume que se assume em pausa/ajuste (ex. 0,25 = um conjunto grande).
 */
export function linearWeeklyBudgetIfPauseFraction(args: {
  spendLast7Days: number;
  pauseFraction?: number;
}): LinearPauseHint | null {
  if (args.spendLast7Days <= 0) return null;
  const avgDaily = args.spendLast7Days / 7;
  const pauseFraction =
    typeof args.pauseFraction === "number" &&
    args.pauseFraction > 0 &&
    args.pauseFraction <= 1
      ? args.pauseFraction
      : 0.25;
  const daysRemaining = calendarDaysLeftThisWeek();
  const approxSaved = avgDaily * pauseFraction * daysRemaining;
  return {
    approxSaved,
    avgDailySpend: avgDaily,
    pauseFraction,
    daysRemaining,
  };
}
