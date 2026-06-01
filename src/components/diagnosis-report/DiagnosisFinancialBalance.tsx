import type { FinancialBalance } from "./types";

type Props = {
  balance: FinancialBalance;
};

export function DiagnosisFinancialBalance({ balance }: Props) {
  const invested = balance.invested30d;
  const profit = balance.mediaProfit30d ?? 0;
  const risk = balance.atRisk30d;
  const recover = balance.recoverableConservative;

  const pct = (n: number) =>
    invested > 0 ? Math.min(100, Math.round((n / invested) * 100)) : 0;

  return (
    <section className="card balance-sheet" id="financeiro">
      <h2>Balanço dos últimos 30 dias</h2>
      <p className="section-hint">{balance.allocationNote}</p>
      <div className="balance-grid">
        <div className="balance-line">
          <span>Investimento em mídia</span>
          <strong>{balance.investedFormatted}</strong>
        </div>
        <div className="balance-line">
          <span>Receita rastreada (Vendas)</span>
          <strong>{balance.revenueFormatted}</strong>
        </div>
        <div className="balance-line">
          <span>Lucro de mídia estimado</span>
          <strong>{balance.mediaProfitFormatted}</strong>
        </div>
        <div className="balance-line balance-line-risk">
          <span>Verba em risco / sem visibilidade</span>
          <strong>{balance.atRiskFormatted}</strong>
        </div>
        <div className="balance-line balance-line-gain">
          <span>Recuperação indicativa (conservador)</span>
          <strong>{balance.recoverableConservativeFormatted}</strong>
        </div>
      </div>
      {invested > 0 ? (
        <div className="allocation-bar" aria-label="Alocação do investimento">
          <div className="allocation-track">
            {profit > 0 ? (
              <span
                className="allocation-seg allocation-profit"
                style={{ width: `${pct(profit)}%` }}
                title="Lucro de mídia"
              />
            ) : null}
            {risk > 0 ? (
              <span
                className="allocation-seg allocation-risk"
                style={{ width: `${pct(risk)}%` }}
                title="Em risco"
              />
            ) : null}
            {recover > 0 ? (
              <span
                className="allocation-seg allocation-recover"
                style={{ width: `${pct(recover)}%` }}
                title="Recuperável"
              />
            ) : null}
          </div>
          <div className="allocation-legend">
            <span><i className="leg-profit" /> Lucro</span>
            <span><i className="leg-risk" /> Risco</span>
            <span><i className="leg-recover" /> Recuperável</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
