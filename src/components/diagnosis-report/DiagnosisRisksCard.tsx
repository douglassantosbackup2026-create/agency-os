import type { SeniorDerived } from "./types";

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  warning: "Atenção",
  info: "Info",
};

type Props = {
  risks: SeniorDerived["risks"];
};

export function DiagnosisRisksCard({ risks }: Props) {
  if (!risks.length) return null;
  return (
    <section className="card risks-card" id="riscos">
      <h2>Riscos estruturados</h2>
      <p className="section-hint">
        Sinais prioritários calculados no servidor — a IA deve alinhar os problemas críticos a estes IDs.
      </p>
      <ul className="risks-list">
        {risks.map((r) => (
          <li key={r.id} className={`risk-row severity-${r.severity}`}>
            <div className="risk-head">
              <span className="risk-id muted">{r.id}</span>
              <span className={`risk-severity badge severity-${r.severity}`}>
                {SEVERITY_LABEL[r.severity] ?? r.severity}
              </span>
            </div>
            <p className="risk-title">{r.title}</p>
            <p className="muted risk-evidence">{r.evidence}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
