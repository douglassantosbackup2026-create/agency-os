import type { LeakByAxisItem } from "../types";

type Props = {
  items: LeakByAxisItem[];
  totalFormatted?: string | null;
};

function severityClass(severity: string): string {
  if (severity === "critical") return "severity-critical";
  if (severity === "warning") return "severity-high";
  return "severity-medium";
}

function impactLabel(severity: string): string {
  if (severity === "critical") return "ALTO IMPACTO";
  if (severity === "warning") return "MÉDIO";
  return "BAIXO";
}

export function DiagnosisLossGrid({ items, totalFormatted }: Props) {
  if (!items.length) return null;
  return (
    <section className="card" id="vazamentos">
      <p className="presentation-section-eyebrow">03 · Onde perde</p>
      <h2 className="premium-section-title">Onde o dinheiro está sendo perdido</h2>
      {totalFormatted ? (
        <p className="premium-section-hint">
          Impacto indicativo total: <strong>{totalFormatted}/mês</strong>
        </p>
      ) : (
        <p className="premium-section-hint">Estimativa por eixo — calculada no servidor.</p>
      )}
      <div className="premium-grid-4">
        {items.map((item) => (
          <div key={item.axis} className="premium-kpi-card premium-loss-card">
            <span className={`severity-pill ${severityClass(item.severity)}`}>
              {impactLabel(item.severity)}
            </span>
            <h3 style={{ fontSize: "0.95rem", margin: "0.5rem 0 0.25rem" }}>{item.axisLabel}</h3>
            <span className="premium-loss-amount">{item.monthlyFormatted}</span>
            <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
              {item.headline}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
