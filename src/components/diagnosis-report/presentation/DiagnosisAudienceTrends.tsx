import type { AdsetTrendRow } from "../types";
import { audienceTypePt } from "./meta-senior-labels";

type Props = {
  trends: AdsetTrendRow[];
};

function trendArrow(t: AdsetTrendRow): string {
  if (t.ctrChangePct == null) return "—";
  const sign = t.ctrChangePct > 0 ? "+" : "";
  return `${sign}${t.ctrChangePct}% CTR`;
}

export function DiagnosisAudienceTrends({ trends }: Props) {
  const notable = trends
    .filter((t) => t.ctrChangePct != null && Math.abs(t.ctrChangePct) >= 3)
    .slice(0, 10);
  if (!notable.length) return null;

  return (
    <section className="card presentation-layout-section" id="sec-trends">
      <p className="presentation-section-eyebrow">03 · Públicos · Tendência</p>
      <h2 className="premium-section-title">Variação de CTR por conjunto</h2>
      <p className="premium-section-hint muted">
        Período atual vs. 30 dias anteriores — apenas conjuntos com gasto relevante.
      </p>
      <div className="premium-grid-2 meta-trends-grid">
        {notable.map((t) => (
          <div
            key={t.adsetId}
            className={`premium-kpi-card meta-trend-card meta-trend-${t.trend}`}
          >
            <span className="premium-kpi-label">{audienceTypePt(t.audienceType)}</span>
            <h3 style={{ fontSize: "0.92rem", margin: "0.35rem 0" }}>{t.adsetName}</h3>
            <span className="premium-kpi-value">{trendArrow(t)}</span>
            <p className="muted" style={{ fontSize: "0.78rem", margin: "0.35rem 0 0" }}>
              CTR {t.ctrNow}% (antes {t.ctrPrev}%)
              {t.campaignName ? ` · ${t.campaignName}` : ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
