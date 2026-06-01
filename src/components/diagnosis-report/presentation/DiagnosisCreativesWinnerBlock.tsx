import type { AdVideoDiagnostic, WinnerUnderinvested } from "../types";

type Props = {
  winner?: WinnerUnderinvested | null;
  videos: AdVideoDiagnostic[];
};

export function DiagnosisCreativesWinnerBlock({ winner, videos }: Props) {
  const best = videos.find((v) => v.isBestCandidate) ?? videos[0];
  const worst = videos.find((v) => v.isWorstCandidate || v.pauseCandidate);

  if (!winner && !best && !worst) return null;

  return (
    <section className="card presentation-layout-section" id="bloco-criativos">
      <p className="presentation-section-eyebrow">05 · Criativos</p>
      <h2 className="premium-section-title">Melhor e pior no período</h2>

      {winner ? (
        <div className="premium-kpi-card meta-reco-card" style={{ marginBottom: "0.75rem" }}>
          <span className="severity-pill severity-medium">Oportunidade</span>
          <h3 style={{ fontSize: "0.95rem", margin: "0.5rem 0" }}>{winner.adName}</h3>
          <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
            ROAS {winner.roas}× com apenas {winner.spendNote} — criativo suprimido no conjunto{" "}
            {winner.campaignName}. Isolar em ad set dedicado com budget exclusivo.
          </p>
        </div>
      ) : null}

      <div className="premium-grid-2">
        {best ? (
          <div className="premium-kpi-card meta-trend-good">
            <span className="premium-kpi-label">Melhor sinal</span>
            <strong>{best.adName}</strong>
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
              {best.roas != null ? `ROAS ${best.roas}× · ` : ""}
              {best.diagnosisPt}
            </p>
          </div>
        ) : null}
        {worst ? (
          <div className="premium-kpi-card meta-trend-bad">
            <span className="premium-kpi-label">Pausar?</span>
            <strong>{worst.adName}</strong>
            <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
              {worst.roas != null ? `ROAS ${worst.roas}× · ` : ""}
              {worst.diagnosisPt}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
