import type { DiagnosisAnalysis } from "./types";

const ENGINE_LABEL: Record<string, string> = {
  leak: "Vazamento",
  growth: "Crescimento",
  risk: "Risco",
  action: "Ação",
};

type Issue = NonNullable<DiagnosisAnalysis["criticalIssues"]>[number];

type Props = {
  issue: Issue;
  priorityBadge: (priority: string) => string;
  axisLabelPt: (axis: string) => string;
};

export function DiagnosisIssueCard({ issue, priorityBadge, axisLabelPt }: Props) {
  const axis = "axis" in issue ? issue.axis : null;
  const engine = "engine" in issue ? issue.engine : null;

  return (
    <div className="issue-card issue-card-v9">
      <div className="issue-icon">⚠️</div>
      <div className="issue-card-body">
        <h3>{issue.title}</h3>
        <p className="muted" style={{ margin: "0 0 0.5rem" }}>
          {issue.description}
        </p>
        {issue.cause ? (
          <p className="issue-cause">
            <strong>Por quê:</strong> {issue.cause}
          </p>
        ) : null}
        {issue.consequence ? (
          <p className="issue-consequence">
            <strong>Impacto:</strong> {issue.consequence}
          </p>
        ) : null}
        {issue.financialNote ? (
          <p className="issue-financial">{issue.financialNote}</p>
        ) : null}
        <div className="issue-meta-row">
          <span className={`badge ${priorityBadge(issue.priority)}`}>
            {issue.priority}
          </span>
          {axis ? (
            <span className="badge badge-medium">{axisLabelPt(String(axis))}</span>
          ) : null}
          {engine ? (
            <span className="badge badge-low">
              {ENGINE_LABEL[String(engine)] ?? String(engine)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
