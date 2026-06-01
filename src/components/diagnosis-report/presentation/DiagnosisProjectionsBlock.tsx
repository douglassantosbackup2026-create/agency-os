import type { GrowthIntelligenceDerived } from "../types";

type Props = {
  projections: GrowthIntelligenceDerived["projections"];
};

export function DiagnosisProjectionsBlock({ projections }: Props) {
  if (!projections.scenarios.length) return null;
  return (
    <section className="card presentation-projections" id="sec-projections">
      <p className="presentation-section-eyebrow">09 · Potencial</p>
      <h2 className="premium-section-title">Potencial de crescimento</h2>
      <p className="premium-section-hint muted">{projections.disclaimer}</p>
      <div className="premium-grid-3">
        {projections.scenarios.map((s) => (
          <div key={s.key} className="premium-kpi-card">
            <span className="presentation-section-eyebrow">{s.label}</span>
            <p className="premium-kpi-value">{s.revenueUpliftFormatted}</p>
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
              Receita adicional est.: {s.additionalRevenueFormatted}/mês
            </p>
            <p className="muted" style={{ margin: 0, fontSize: "0.8rem" }}>
              Prazo: {s.estimatedEta}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
