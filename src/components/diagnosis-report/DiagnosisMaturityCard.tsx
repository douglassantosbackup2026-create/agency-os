import type { MaturityScore } from "./types";

type Props = {
  maturity: MaturityScore;
};

export function DiagnosisMaturityCard({ maturity }: Props) {
  const pct = (maturity.level / 5) * 100;
  return (
    <section className="card maturity-card" id="maturidade">
      <h2>Meta Ads Maturity Score</h2>
      <p className="section-hint">
        Nível {maturity.level}/5 — contas elite costumam operar entre 4 e 5.
      </p>
      <div className="maturity-hero">
        <span className="maturity-level" aria-label={`Nível ${maturity.level}`}>
          {maturity.level}
        </span>
        <div>
          <p className="maturity-label">{maturity.label}</p>
          <p className="muted" style={{ margin: 0 }}>
            {maturity.summary}
          </p>
        </div>
      </div>
      <div
        className="maturity-bar"
        role="progressbar"
        aria-valuenow={maturity.level}
        aria-valuemin={1}
        aria-valuemax={5}
      >
        <span className="maturity-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <ul className="maturity-pillars">
        {maturity.pillars.map((p) => (
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
