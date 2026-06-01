import type { FunnelHealthRow } from "../types";
import { funnelStatusClass } from "./meta-senior-labels";

type Props = {
  rows: FunnelHealthRow[];
};

function statusLabel(status: string): string {
  if (status === "critical") return "Crítico";
  if (status === "attention") return "Atenção";
  return "OK";
}

export function DiagnosisFunnelHealth({ rows }: Props) {
  if (!rows.length) return null;

  return (
    <section className="card presentation-layout-section" id="sec-funnel">
      <p className="presentation-section-eyebrow">05 · Funil</p>
      <h2 className="premium-section-title">Saúde por eixo</h2>
      <div className="premium-grid-3 meta-funnel-grid">
        {rows.map((f) => (
          <div key={f.axis} className="premium-kpi-card">
            <span className={`severity-pill ${funnelStatusClass(f.status)}`}>
              {statusLabel(f.status)}
            </span>
            <h3 style={{ fontSize: "0.9rem", margin: "0.45rem 0 0.2rem" }}>{f.label}</h3>
            <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
              {f.note}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
