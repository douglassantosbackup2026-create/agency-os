import type { AuctionAdRow } from "../types";
import { rankingLabelPt } from "./meta-senior-labels";

type Props = {
  rows: AuctionAdRow[];
};

export function DiagnosisCreativeAuctionGrid({ rows }: Props) {
  const top = rows.filter((r) => r.spend > 0).slice(0, 12);
  if (!top.length) return null;

  return (
    <section className="card presentation-layout-section" id="sec-auction">
      <p className="presentation-section-eyebrow">02 · Criativos · Leilão</p>
      <h2 className="premium-section-title">Rankings de leilão (top gasto)</h2>
      <p className="premium-section-hint muted">
        Qualidade, engajamento e conversão vs. anúncios com perfil semelhante — últimos 30 dias.
      </p>
      <div className="meta-auction-table-wrap">
        <table className="meta-auction-table">
          <thead>
            <tr>
              <th>Anúncio</th>
              <th>Qualidade</th>
              <th>Engajamento</th>
              <th>Conversão</th>
              <th>Diagnóstico</th>
            </tr>
          </thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.adId || r.adName} className={r.pauseCandidate ? "meta-row-alert" : ""}>
                <td>
                  <strong>{r.adName}</strong>
                  {r.campaignName ? (
                    <span className="muted meta-cell-sub">{r.campaignName}</span>
                  ) : null}
                  {r.pauseCandidate ? (
                    <span className="severity-pill severity-critical meta-pause-pill">
                      Pausar?
                    </span>
                  ) : null}
                </td>
                <td>{rankingLabelPt(r.quality)}</td>
                <td>{rankingLabelPt(r.engagement)}</td>
                <td>{rankingLabelPt(r.conversion)}</td>
                <td className="meta-diagnosis-cell">{r.diagnosisPt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
