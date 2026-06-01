import type { GrowthIntelligenceDerived } from "../types";

type Props = {
  impacts: GrowthIntelligenceDerived["benchmarkImpacts"];
  nicheLabel?: string | null;
};

export function DiagnosisBenchmarkImpactBlock({ impacts, nicheLabel }: Props) {
  if (!impacts.length) return null;
  return (
    <section className="card presentation-benchmark-impact" id="sec-benchmark">
      <p className="presentation-section-eyebrow">06 · Mercado</p>
      <h2 className="premium-section-title">Benchmark de mercado</h2>
      {nicheLabel ? (
        <p className="premium-section-hint">Referência: {nicheLabel}</p>
      ) : null}
      <ul className="benchmark-impact-list">
        {impacts.map((g) => (
          <li key={g.metric} className="benchmark-impact-row">
            <div className="benchmark-impact-metric">
              <strong>{g.metric}</strong>
              <span className="muted">
                {g.current} vs {g.reference}
              </span>
            </div>
            <p className="benchmark-impact-note">{g.tierNote}</p>
            {g.estimatedImpactFormatted !== "—" ? (
              <p className="benchmark-impact-brl">
                Impacto estimado: <strong>{g.estimatedImpactFormatted}/mês</strong>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
