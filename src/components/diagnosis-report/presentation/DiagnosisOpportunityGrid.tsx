import type { DiagnosisAnalysis, GrowthScenarios } from "../types";

type Props = {
  growth: GrowthScenarios | null | undefined;
  opportunities: DiagnosisAnalysis["opportunities"];
};

export function DiagnosisOpportunityGrid({ growth, opportunities }: Props) {
  const opps = opportunities ?? [];
  if (!growth && !opps.length) return null;

  return (
    <section className="card" id="crescimento">
      <p className="presentation-section-eyebrow">04 · Oportunidades</p>
      <h2 className="premium-section-title">Oportunidades para aumentar seus resultados</h2>
      <p className="premium-section-hint">Cenários indicativos — não são promessa de resultado.</p>
      <div className="premium-grid-4">
        {growth ? (
          <>
            <div className="premium-kpi-card premium-opp-card">
              <span className="premium-kpi-label">Crescimento conservador</span>
              <span className="premium-opp-value">{growth.conservativeFormatted}</span>
            </div>
            <div className="premium-kpi-card premium-opp-card">
              <span className="premium-kpi-label">Cenário provável</span>
              <span className="premium-opp-value">{growth.probableFormatted}</span>
            </div>
            <div className="premium-kpi-card premium-opp-card">
              <span className="premium-kpi-label">Cenário agressivo</span>
              <span className="premium-opp-value">{growth.aggressiveFormatted}</span>
            </div>
          </>
        ) : null}
        {opps.slice(0, growth ? 1 : 4).map((o) => (
          <div key={o.title} className="premium-kpi-card premium-opp-card">
            <span className="premium-kpi-label">{o.title}</span>
            <p className="muted" style={{ fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
              {o.potentialNote}
            </p>
            <span className={`severity-pill severity-medium`}>{o.complexity}</span>
          </div>
        ))}
      </div>
      {growth?.basisNote ? (
        <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.75rem", marginBottom: 0 }}>
          {growth.basisNote}
        </p>
      ) : null}
    </section>
  );
}
