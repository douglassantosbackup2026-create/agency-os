import { DiagnosisScoreGauge } from "./DiagnosisScoreGauge";

type Props = {
  score: number;
  scoreLabel: string;
  scoreTier: "low" | "mid" | "high";
  verdictLine: string;
  leakTotalFormatted?: string | null;
  benchmarkNote?: string | null;
  accountLabel?: string | null;
  periodLabel?: string | null;
  completedAtLabel?: string | null;
};

export function DiagnosisPresentationHero({
  score,
  scoreLabel,
  scoreTier,
  verdictLine,
  leakTotalFormatted,
  benchmarkNote,
  accountLabel,
  periodLabel,
  completedAtLabel,
}: Props) {
  const metaParts = [accountLabel, periodLabel, completedAtLabel].filter(Boolean);

  return (
    <section className="card premium-hero verdict-hero presentation-layout-section" id="veredito">
      <div>
        <p className="muted" style={{ margin: "0 0 0.5rem", fontSize: "0.85rem" }}>
          Analista v13
        </p>
        <h1 className="premium-hero-headline">Resultado da auditoria Meta Ads</h1>
        {metaParts.length ? (
          <p className="muted" style={{ margin: "0 0 0.75rem", fontSize: "0.88rem" }}>
            {metaParts.join(" · ")}
          </p>
        ) : null}
        {leakTotalFormatted ? (
          <div className="premium-pain-box">
            Identificamos até{" "}
            <strong>{leakTotalFormatted}/mês</strong> em vazamentos e ineficiências
            corrigíveis com os dados do período.
          </div>
        ) : null}
        <p className="verdict-line" style={{ margin: "0.75rem 0 0", lineHeight: 1.5 }}>
          {verdictLine}
        </p>
      </div>
      <DiagnosisScoreGauge
        score={score}
        scoreLabel={scoreLabel}
        scoreTier={scoreTier}
        benchmarkNote={benchmarkNote}
      />
    </section>
  );
}
