/**
 * Dicas determinísticas a partir do contexto de negócio informado pelo usuário.
 */

export type BusinessContextInput = {
  niche?: string | null;
  avg_ticket_brl?: number | null;
  margin_pct?: number | null;
  monthly_goal_brl?: number | null;
  target_roas?: number | null;
  notes?: string | null;
};

export type BusinessHints = {
  breakevenRoas: number | null;
  breakevenRoasFormatted: string | null;
  marginNote: string | null;
};

/** ROAS mínimo indicativo ≈ 1 / margem (ex.: 30% margem → ~3.33x). */
export function deriveBreakevenRoas(marginPct: number | null | undefined): number | null {
  if (marginPct == null || marginPct <= 0 || marginPct >= 100) return null;
  const m = marginPct / 100;
  return Math.round((1 / m) * 100) / 100;
}

export function deriveBusinessHints(
  ctx: BusinessContextInput | null | undefined,
): BusinessHints | null {
  if (!ctx) return null;
  const margin = ctx.margin_pct;
  const breakeven = deriveBreakevenRoas(margin);
  const parts: string[] = [];
  if (breakeven != null && margin != null) {
    parts.push(
      `Com margem indicativa de ${margin}% no produto, ROAS mínimo aproximado para empatar custos de mídia: ~${breakeven}x (indicativo, não garantia).`,
    );
  }
  if (ctx.avg_ticket_brl != null && ctx.avg_ticket_brl > 0) {
    parts.push(
      `Ticket médio informado: R$ ${ctx.avg_ticket_brl.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.`,
    );
  }
  if (ctx.monthly_goal_brl != null && ctx.monthly_goal_brl > 0) {
    parts.push(
      `Meta mensal declarada: R$ ${ctx.monthly_goal_brl.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.`,
    );
  }
  if (!parts.length && !ctx.niche) return null;

  return {
    breakevenRoas: breakeven,
    breakevenRoasFormatted: breakeven != null ? `${breakeven}x` : null,
    marginNote: parts.length ? parts.join(" ") : null,
  };
}
