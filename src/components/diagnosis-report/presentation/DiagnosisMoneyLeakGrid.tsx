import type { MoneyLeakItem } from "../types";

type Props = {
  leaks: MoneyLeakItem[];
  totalFormatted?: string | null;
  isHealthy?: boolean;
};

export function DiagnosisMoneyLeakGrid({ leaks, totalFormatted, isHealthy }: Props) {
  if (!leaks.length) return null;
  const top = leaks.slice(0, 6);
  const eyebrow = isHealthy ? "02 · Teto de crescimento" : "02 · Dinheiro na mesa";
  const title = isHealthy
    ? "Teto disponível para subir do bom para o excepcional"
    : "Quanto dinheiro está ficando na mesa";
  return (
    <section className="card" id="vazamentos">
      <p className="presentation-section-eyebrow">{eyebrow}</p>
      <h2 className="premium-section-title">{title}</h2>
      {totalFormatted ? (
        <p className="premium-section-hint">
          {isHealthy ? "Teto identificado" : "Top vazamentos (servidor)"}:{" "}
          <strong>{totalFormatted}/mês</strong>
        </p>
      ) : null}
      <ol className="money-leak-list">
        {top.map((item) => {
          const ev = item.evidenceStrength;
          const trend = item.trend;
          return (
            <li key={item.id} className="money-leak-item">
              <div className="money-leak-head">
                <span className="money-leak-rank">#{item.priority}</span>
                <strong>{item.title}</strong>
                <span className="money-leak-amount">{item.monthlyImpactFormatted}/mês</span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.4rem",
                  marginBottom: "0.35rem",
                }}
              >
                {ev && ev.tier === "low" ? (
                  <span
                    className="severity-pill"
                    style={{
                      background: "rgba(234,179,8,0.12)",
                      color: "#92400e",
                      fontSize: "0.75rem",
                    }}
                    title="Volume baixo de compras — evidência ainda inicial"
                  >
                    Evidência: {ev.purchases} compra{ev.purchases === 1 ? "" : "s"}
                  </span>
                ) : null}
                {ev && ev.tier === "medium" ? (
                  <span
                    className="severity-pill severity-medium"
                    style={{ fontSize: "0.75rem" }}
                    title="Evidência média"
                  >
                    Evidência: {ev.purchases} compras
                  </span>
                ) : null}
                {trend && trend.direction !== "unknown" ? (
                  <span
                    className="severity-pill"
                    style={{
                      background:
                        trend.direction === "deteriorating"
                          ? "rgba(220,38,38,0.12)"
                          : trend.direction === "improving"
                            ? "rgba(16,185,129,0.12)"
                            : "rgba(100,116,139,0.12)",
                      color:
                        trend.direction === "deteriorating"
                          ? "#b91c1c"
                          : trend.direction === "improving"
                            ? "#047857"
                            : "#475569",
                      fontSize: "0.75rem",
                    }}
                    title={trend.summaryPt ?? trend.badge}
                  >
                    {trend.badge}
                  </span>
                ) : null}
              </div>
              <p className="muted money-leak-cause">{item.rootCause}</p>
              <p className="money-leak-action">{item.action}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
