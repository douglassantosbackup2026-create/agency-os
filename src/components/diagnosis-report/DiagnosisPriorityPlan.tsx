import type { DiagnosisAnalysis } from "./types";

type Action = NonNullable<DiagnosisAnalysis["prioritizedActions"]>[number];

const URGENCY_LABEL: Record<string, string> = {
  now: "Agora",
  soon: "Em breve",
  later: "Depois",
};

const EFFORT_LABEL: Record<string, string> = {
  low: "Baixo esforço",
  medium: "Médio",
  high: "Alto",
};

type Props = {
  actions: Action[];
  mondayActions?: Action[];
  axisLabelPt: (axis: string) => string;
};

export function DiagnosisPriorityPlan({
  actions,
  mondayActions,
  axisLabelPt,
}: Props) {
  if (!actions.length) return null;

  const now = mondayActions?.length
    ? mondayActions
    : actions.filter((a) => a.urgency === "now").slice(0, 3);

  const highImpact = (a: Action) => (a.impactBrl ?? 0) >= 500;
  const matrix = {
    nowHigh: actions.filter((a) => a.urgency === "now" && highImpact(a)),
    nowOther: actions.filter((a) => a.urgency === "now" && !highImpact(a)),
    laterHigh: actions.filter((a) => a.urgency !== "now" && highImpact(a)),
    laterOther: actions.filter((a) => a.urgency !== "now" && !highImpact(a)),
  };

  return (
    <section className="diagnosis-priority-plan">
      {now.length > 0 ? (
        <div className="monday-actions-block">
          <h2 className="section-title">Segunda-feira — top {now.length}</h2>
          <ul className="monday-actions-list">
            {now.map((a) => (
              <li key={a.step} className="monday-action-item">
                <strong>{a.action}</strong>
                <div className="issue-meta-row" style={{ marginTop: "0.35rem" }}>
                  <span className="badge badge-critical">
                    {URGENCY_LABEL[a.urgency] ?? a.urgency}
                  </span>
                  {a.impactBrl != null && a.impactBrl > 0 ? (
                    <span className="badge badge-medium">
                      ~R${" "}
                      {a.impactBrl.toLocaleString("pt-BR", {
                        maximumFractionDigits: 0,
                      })}
                      /mês
                    </span>
                  ) : null}
                  <span className="badge badge-low">
                    {EFFORT_LABEL[a.effort] ?? a.effort}
                  </span>
                  {a.relatedAxis ? (
                    <span className="badge badge-medium">
                      {axisLabelPt(String(a.relatedAxis))}
                    </span>
                  ) : null}
                </div>
                <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                  {a.impact}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="priority-matrix-details">
        <summary>Matriz impacto × urgência</summary>
        <div className="priority-matrix-grid" role="table" aria-label="Matriz de prioridade">
          <div className="priority-matrix-row priority-matrix-header">
            <span />
            <span>Alto impacto (~R$ 500+/mês)</span>
            <span>Outros</span>
          </div>
          <div className="priority-matrix-row">
            <span className="priority-matrix-label">Agora</span>
            <span>{matrix.nowHigh.length} ação(ões)</span>
            <span>{matrix.nowOther.length} ação(ões)</span>
          </div>
          <div className="priority-matrix-row">
            <span className="priority-matrix-label">Depois</span>
            <span>{matrix.laterHigh.length} ação(ões)</span>
            <span>{matrix.laterOther.length} ação(ões)</span>
          </div>
        </div>
      </details>

      <details className="priority-matrix-details">
        <summary>Plano completo priorizado ({actions.length} passos)</summary>
        <ol className="priority-plan-list">
          {actions.map((a) => (
            <li key={a.step}>
              <span className="priority-step-num">{a.step}.</span> {a.action}
              <span className="muted">
                {" "}
                · {URGENCY_LABEL[a.urgency]} · {a.eta}
                {a.impactBrl != null && a.impactBrl > 0
                  ? ` · ~R$ ${a.impactBrl.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês`
                  : ""}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
