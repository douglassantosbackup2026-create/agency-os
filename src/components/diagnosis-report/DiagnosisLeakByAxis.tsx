import type { LeakByAxisItem } from "./types";

type Props = {
  items: LeakByAxisItem[];
};

export function DiagnosisLeakByAxis({ items }: Props) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.monthlyBrl), 1);
  return (
    <section className="card leak-by-axis" id="vazamentos">
      <h2>Onde o dinheiro vaza</h2>
      <p className="section-hint">
        Estimativa mensal por eixo (estrutura, públicos, criativo, vendas) — calculada no servidor.
      </p>
      <ul className="leak-axis-list">
        {items.map((item) => (
          <li
            key={item.axis}
            className={`leak-axis-row severity-${item.severity}`}
          >
            <div className="leak-axis-head">
              <span className="leak-axis-label">{item.axisLabel}</span>
              <span className="leak-axis-value">{item.monthlyFormatted}</span>
            </div>
            <div
              className="leak-axis-bar"
              aria-hidden
              style={{ width: `${Math.round((item.monthlyBrl / max) * 100)}%` }}
            />
            <p className="leak-axis-headline">{item.headline}</p>
            <p className="muted leak-axis-evidence">{item.evidence}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
