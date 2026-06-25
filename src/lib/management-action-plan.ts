export type RawActionPlanStep = {
  step?: number;
  action?: string;
  impact?: string;
  eta?: string;
  urgency?: string;
  effort?: string;
  impactBrl?: number | null;
};

export function mapUrgencyToPriority(
  urgency: string | undefined,
): "baixa" | "media" | "alta" | "critica" {
  if (urgency === "now") return "alta";
  if (urgency === "soon") return "media";
  return "baixa";
}

export function parseActionPlan(
  analysis: Record<string, unknown> | null | undefined,
): RawActionPlanStep[] {
  if (!analysis || typeof analysis !== "object") return [];
  const plan = analysis.actionPlan;
  if (!Array.isArray(plan)) return [];
  return plan.filter((x) => x && typeof x === "object") as RawActionPlanStep[];
}
