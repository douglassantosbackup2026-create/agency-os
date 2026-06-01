import type { MoneyLeakItem } from "../types";

type Props = {
  leaks: MoneyLeakItem[];
  totalFormatted?: string | null;
};

export function DiagnosisMoneyLeakGrid({ leaks, totalFormatted }: Props) {
  if (!leaks.length) return null;
  const top = leaks.slice(0, 6);
  return (
    <section className="card" id="vazamentos">
      <p className="presentation-section-eyebrow">02 · Dinheiro na mesa</p>
      <h2 className="premium-section-title">Quanto dinheiro está ficando na mesa</h2>
      {totalFormatted ? (
        <p className="premium-section-hint">
          Top vazamentos (servidor): <strong>{totalFormatted}/mês</strong> somados nos itens abaixo
        </p>
      ) : null}
      <ol className="money-leak-list">
        {top.map((item) => (
          <li key={item.id} className="money-leak-item">
            <div className="money-leak-head">
              <span className="money-leak-rank">#{item.priority}</span>
              <strong>{item.title}</strong>
              <span className="money-leak-amount">{item.monthlyImpactFormatted}/mês</span>
            </div>
            <p className="muted money-leak-cause">{item.rootCause}</p>
            <p className="money-leak-action">{item.action}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
