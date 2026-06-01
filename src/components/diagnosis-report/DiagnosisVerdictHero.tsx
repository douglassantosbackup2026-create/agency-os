import type { DiagnosisAnalysis, FinancialBalance } from "./types";

type Props = {
  analysis: DiagnosisAnalysis;
  balance: FinancialBalance | null;
  scoreTier: "low" | "mid" | "high";
  scoreLegendOpen: boolean;
  onToggleScoreLegend: () => void;
};

export function DiagnosisVerdictHero({
  analysis,
  balance,
  scoreTier,
  scoreLegendOpen,
  onToggleScoreLegend,
}: Props) {
  const score = analysis.score;
  const verdict =
    analysis.verdictLine?.trim() ||
    analysis.narrativeHook?.trim() ||
    analysis.storyExecutive?.headline ||
    analysis.summary.split(".")[0];

  const invested = balance?.investedFormatted ?? analysis.financialImpact?.spendFormatted;
  const atRisk = balance?.atRiskFormatted ?? analysis.financialImpact?.lossMonthlyFormatted;
  const recover =
    balance?.recoverableConservativeFormatted &&
    balance?.recoverableOptimisticFormatted
      ? `${balance.recoverableConservativeFormatted} – ${balance.recoverableOptimisticFormatted}`
      : analysis.storyExecutive?.recoveryRangeFormatted ??
        analysis.financialImpact?.recoveryConservativeFormatted;

  return (
    <header className="card verdict-hero" id="veredito">
      <span className="eyebrow">Veredito · Diagnóstico Meta Ads</span>
      <div className="verdict-score-block">
        <div>
          <p className="verdict-score-label">Score de saúde</p>
          <div
            className="score-big"
            style={{
              color:
                scoreTier === "low"
                  ? "var(--diag-score-low)"
                  : scoreTier === "mid"
                    ? "var(--diag-score-mid)"
                    : "var(--diag-score-high)",
            }}
          >
            {score}
            <span className="score-denom">/100</span>
          </div>
          <div className={`score-bar score-${scoreTier}`}>
            <span style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
          </div>
          <p className="verdict-score-badge">{analysis.scoreLabel}</p>
          <button
            type="button"
            className="score-legend-toggle no-print"
            onClick={onToggleScoreLegend}
            aria-expanded={scoreLegendOpen}
          >
            {scoreLegendOpen ? "Ocultar" : "Como calculamos o score"}
          </button>
          {scoreLegendOpen && analysis.scoreExplanation ? (
            <div className="score-legend-panel">
              <p className="muted score-legend-note">
                {analysis.scoreExplanation.formulaNote}
              </p>
              <ul className="score-pillars">
                {analysis.scoreExplanation.pillars?.map((p) => (
                  <li key={p.id}>
                    <strong>{p.label}:</strong> {p.value}
                    <span className="muted"> — {p.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="verdict-kpi-strip">
          {invested ? (
            <div className="verdict-kpi">
              <span className="verdict-kpi-label">Investiu (30d)</span>
              <span className="verdict-kpi-value">{invested}</span>
            </div>
          ) : null}
          {atRisk && atRisk !== "—" ? (
            <div className="verdict-kpi verdict-kpi-risk">
              <span className="verdict-kpi-label">Em risco</span>
              <span className="verdict-kpi-value">{atRisk}</span>
            </div>
          ) : null}
          {recover && recover !== "—" ? (
            <div className="verdict-kpi verdict-kpi-gain">
              <span className="verdict-kpi-label">Recuperável</span>
              <span className="verdict-kpi-value verdict-kpi-value-sm">{recover}</span>
            </div>
          ) : null}
        </div>
      </div>
      <p className="verdict-line">{verdict}</p>
      {balance?.netPositionLabel ? (
        <p className="verdict-sub muted">{balance.netPositionLabel}</p>
      ) : null}
    </header>
  );
}
