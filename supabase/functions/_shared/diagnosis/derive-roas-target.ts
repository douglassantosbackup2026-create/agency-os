import { deriveBreakevenRoas, type BusinessContextInput } from "./derive-business-hints.ts";
import { referenceRoasIdeal } from "./benchmark-loader.ts";

export type RoasTargetSource = "declared" | "breakeven" | "niche";

export type ResolvedRoasTarget = {
  target: number;
  source: RoasTargetSource;
  label: string;
};

export function resolveRoasTarget(
  ctx: BusinessContextInput | null | undefined,
  nicheKey: string,
): ResolvedRoasTarget {
  const declared = ctx?.target_roas;
  if (declared != null && declared > 0) {
    return {
      target: declared,
      source: "declared",
      label: `Meta declarada ${declared.toFixed(1).replace(".", ",")}×`,
    };
  }

  const breakeven = deriveBreakevenRoas(ctx?.margin_pct);
  if (breakeven != null && breakeven > 0) {
    return {
      target: breakeven,
      source: "breakeven",
      label: `Break-even (~${breakeven.toFixed(1).replace(".", ",")}×)`,
    };
  }

  const niche = referenceRoasIdeal(nicheKey);
  return {
    target: niche,
    source: "niche",
    label: `Referência ideal nicho ${niche.toFixed(1).replace(".", ",")}×`,
  };
}

/** Meta CTR em percentual — Meta pode devolver fração (<0.5) ou percentual já escalado. */
export function normalizeCtrPct(ctr: number | null | undefined): number | null {
  if (ctr == null || !Number.isFinite(ctr)) return null;
  if (ctr > 0 && ctr < 0.5) return ctr * 100;
  return ctr;
}
