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

export function actionCenterRowsFromPlan(
  agencyId: string,
  clientId: string,
  diagnosisId: string,
  analysis: Record<string, unknown> | null | undefined,
  createdBy: string | null,
): Array<{
  agency_id: string;
  client_id: string;
  source_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  created_by: string | null;
  metadata: Record<string, unknown>;
}> {
  const steps = parseActionPlan(analysis);
  return steps.map((step, idx) => ({
    agency_id: agencyId,
    client_id: clientId,
    source_type: "manual",
    title: String(step.action ?? `Ação ${idx + 1}`).slice(0, 500),
    description: [step.impact, step.eta ? `Prazo: ${step.eta}` : null]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 2000) || null,
    priority: mapUrgencyToPriority(step.urgency),
    status: "pendente",
    created_by: createdBy,
    metadata: {
      diagnosis_id: diagnosisId,
      action_step: step.step ?? idx + 1,
      urgency: step.urgency ?? null,
      effort: step.effort ?? null,
      impact_brl: step.impactBrl ?? null,
    },
  }));
}
