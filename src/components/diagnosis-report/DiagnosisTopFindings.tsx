import { AlertTriangle } from "lucide-react";
import type { TopFinding } from "./types";

type Props = {
  findings: TopFinding[];
};

export function DiagnosisTopFindings({ findings }: Props) {
  if (!findings.length) return null;
  return (
    <section className="card findings-section" id="achados">
      <h2 className="findings-title">
        <AlertTriangle className="findings-title-icon" aria-hidden />
        Top {findings.length} achado{findings.length > 1 ? "s" : ""}
      </h2>
      <p className="section-hint">
        Prioridade por impacto estimado na sua conta — valores calculados no servidor.
      </p>
      <ol className="findings-list">
        {findings.map((f) => (
          <li
            key={`${f.rank}-${f.campaignName}`}
            className={`finding-row severity-${f.severity}`}
          >
            <span className="finding-rank">{f.rank}</span>
            <div className="finding-body">
              <p className="finding-headline">{f.headline}</p>
              <p className="finding-meta muted">
                {f.objectiveFamily} · {f.evidence}
              </p>
              <p className="finding-action">
                <strong>Ação:</strong> {f.actionHint}
              </p>
            </div>
            {f.monthlyImpactFormatted !== "—" ? (
              <span className="finding-impact">{f.monthlyImpactFormatted}</span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
