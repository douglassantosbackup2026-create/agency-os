type Props = {
  score: number;
  scoreLabel: string;
  scoreTier: "low" | "mid" | "high";
  benchmarkNote?: string | null;
};

const TIER_COLOR = {
  low: "var(--diag-score-low, #dc2626)",
  mid: "var(--diag-score-mid, #d97706)",
  high: "var(--diag-score-high, #059669)",
};

export function DiagnosisScoreGauge({
  score,
  scoreLabel,
  scoreTier,
  benchmarkNote,
}: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const color = TIER_COLOR[scoreTier];

  return (
    <div className="premium-score-gauge" aria-label={`Score ${clamped} de 100`}>
      <svg width="140" height="140" viewBox="0 0 140 140" role="img">
        <circle
          className="gauge-track"
          cx="70"
          cy="70"
          r={r}
          fill="none"
          strokeWidth="10"
        />
        <circle
          className="gauge-progress"
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          className="gauge-score"
          x="70"
          y="68"
          textAnchor="middle"
          fontSize="28"
          fontWeight="800"
        >
          {clamped}
        </text>
        <text className="gauge-denom" x="70" y="88" textAnchor="middle" fontSize="12">
          /100
        </text>
      </svg>
      <p className="premium-gauge-label" style={{ textAlign: "center", margin: "0.35rem 0 0" }}>
        {scoreLabel}
      </p>
      {benchmarkNote ? (
        <p className="muted" style={{ fontSize: "0.8rem", textAlign: "center", margin: 0 }}>
          {benchmarkNote}
        </p>
      ) : null}
    </div>
  );
}
