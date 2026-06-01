import type { GrowthIntelligenceDerived, MaturityScore } from "./types";

type Props = {
  maturity: MaturityScore;
  enterprise?: GrowthIntelligenceDerived["maturity"] | null;
};

export function DiagnosisMaturityCard({ maturity, enterprise }: Props) {
  const score = enterprise?.score0to100 ?? Math.round((maturity.level / 5) * 100);
  const label = enterprise?.enterpriseLabel ?? maturity.label;
  const summary = enterprise?.summary ?? maturity.summary;
  const pillars = enterprise?.pillars?.length ? enterprise.pillars : maturity.pillars;
  const blockers = enterprise?.blockersToNextLevel ?? [];

  return (
    <section className="card maturity-card" id="maturidade">
      <p className="presentation-section-eyebrow">07 · Maturidade</p>
      <h2 className="premium-section-title">Score de maturidade</h2>
      <p className="section-hint">
        {score}/100 — {label}
        {enterprise ? " (escala Enterprise)" : ` · nível legado ${maturity.level}/5`}
      </p>
      <div className="maturity-hero">
        <span className="maturity-level" aria-label={`Score ${score}`}>
          {score}
        </span>
        <div>
          <p className="maturity-label">{label}</p>
          <p className="muted" style={{ margin: 0 }}>
            {summary}
          </p>
        </div>
      </div>
      <div
        className="maturity-bar"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="maturity-bar-fill" style={{ width: `${score}%` }} />
      </div>
      {blockers.length ? (
        <ul className="maturity-blockers">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      <ul className="maturity-pillars">
        {pillars.map((p) => (
          <li key={p.id}>
            <span className="maturity-pillar-label">{p.label}</span>
            <span className="maturity-pillar-score">{p.score}/100</span>
            <span className="muted maturity-pillar-detail">{p.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
