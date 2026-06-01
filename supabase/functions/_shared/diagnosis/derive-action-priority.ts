import type { HypothesisSeed } from "./derive-hypothesis-seeds.ts";
import type { SeniorDerived, LeakByAxisItem } from "./derive-senior-types.ts";

export type ActionUrgency = "now" | "soon" | "later";
export type ActionEffort = "low" | "medium" | "high";

export type PrioritizedAction = {
  step: number;
  action: string;
  impact: string;
  eta: string;
  impactBrl: number | null;
  urgency: ActionUrgency;
  effort: ActionEffort;
  relatedAxis: string | null;
  engine: string;
  rationale: string;
};

type RawPlanStep = {
  step?: number;
  action?: string;
  impact?: string;
  eta?: string;
  relatedAxis?: string | null;
  engine?: string | null;
  impactBrl?: number | null;
  urgency?: ActionUrgency;
  effort?: ActionEffort;
};

function axisFromLeak(leak: LeakByAxisItem): string {
  return leak.axis;
}

function inferUrgency(
  impactBrl: number,
  relatedAxis: string | null,
  senior: SeniorDerived,
): ActionUrgency {
  const criticalRisk = senior.risks.some((r) => r.severity === "critical");
  if (impactBrl >= 1500 || criticalRisk) return "now";
  if (impactBrl >= 400) return "soon";
  return "later";
}

function inferEffort(action: string, relatedAxis: string | null): ActionEffort {
  const a = action.toLowerCase();
  if (/pausar|excluir|desligar|remover/i.test(a)) return "low";
  if (/reestrutur|migrar|novo pixel|recriar conta/i.test(a)) return "high";
  if (relatedAxis === "structure") return "medium";
  return "medium";
}

function leakBrlForAxis(axis: string | null, senior: SeniorDerived): number {
  if (!axis) return 0;
  const item = senior.leakByAxis.find((l) => l.axis === axis);
  return item?.monthlyBrl ?? 0;
}

export function deriveActionPriority(
  senior: SeniorDerived,
  rawPlan: RawPlanStep[] | undefined,
  hypothesisSeeds: HypothesisSeed[],
): PrioritizedAction[] {
  const plan = [...(rawPlan ?? [])];
  if (!plan.length) {
    for (const risk of senior.risks.slice(0, 5)) {
      plan.push({
        step: plan.length + 1,
        action: `Endereçar: ${risk.title}`,
        impact: risk.evidence,
        eta: risk.severity === "critical" ? "3-5 dias" : "1-2 semanas",
        relatedAxis: risk.relatedAxis,
        engine: "risk",
      });
    }
  }

  const enriched: PrioritizedAction[] = plan.map((p, i) => {
    const action = String(p.action ?? "").trim() || `Passo ${i + 1}`;
    const relatedAxis = p.relatedAxis ? String(p.relatedAxis) : null;
    const impactBrl =
      typeof p.impactBrl === "number" && Number.isFinite(p.impactBrl)
        ? p.impactBrl
        : leakBrlForAxis(relatedAxis, senior);
    const urgency = p.urgency ?? inferUrgency(impactBrl, relatedAxis, senior);
    const effort = p.effort ?? inferEffort(action, relatedAxis);
    const seed = hypothesisSeeds.find((h) => h.relatedRiskId && action.includes(h.title.slice(0, 12)));
    return {
      step: typeof p.step === "number" ? p.step : i + 1,
      action,
      impact: String(p.impact ?? "Melhora eficiência e previsibilidade do retorno."),
      eta: String(p.eta ?? "1 semana"),
      impactBrl: impactBrl > 0 ? impactBrl : null,
      urgency,
      effort,
      relatedAxis,
      engine: String(p.engine ?? "action"),
      rationale: seed?.claim ?? `Priorizado por impacto no eixo ${relatedAxis ?? "geral"}.`,
    };
  });

  const order = { now: 0, soon: 1, later: 2 };
  enriched.sort((a, b) => {
    const u = order[a.urgency] - order[b.urgency];
    if (u !== 0) return u;
    return (b.impactBrl ?? 0) - (a.impactBrl ?? 0);
  });

  return enriched.map((a, i) => ({ ...a, step: i + 1 }));
}

export function topActionsNow(actions: PrioritizedAction[], limit = 3): PrioritizedAction[] {
  return actions.filter((a) => a.urgency === "now").slice(0, limit);
}
