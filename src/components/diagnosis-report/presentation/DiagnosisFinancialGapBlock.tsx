import type { AccountFinancialGap } from "../types";

type Props = {
  gap: AccountFinancialGap;
};

export function DiagnosisFinancialGapBlock({ gap }: Props) {
  return (
    <section className="card presentation-layout-section" id="bloco-impacto">
      <p className="presentation-section-eyebrow">01 · Impacto financeiro</p>
      <h2 className="premium-section-title">Quanto você investiu e quanto ficou na mesa</h2>
      <p className="premium-section-hint muted">{gap.periodLabel} · Referência: {gap.nicheLabel}</p>
      <p className="premium-alert-box premium-featured-alert" style={{ marginTop: "0.75rem" }}>
        {gap.headlinePt}
      </p>
      <div className="premium-grid-3" style={{ marginTop: "1rem" }}>
        <div className="premium-kpi-card">
          <span className="premium-kpi-label">Investido</span>
          <span className="premium-kpi-value">{gap.investedFormatted}</span>
        </div>
        <div className="premium-kpi-card">
          <span className="premium-kpi-label">Receita rastreada</span>
          <span className="premium-kpi-value">{gap.revenueActualFormatted}</span>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            ROAS {gap.roasActualFormatted}
          </span>
        </div>
        <div className="premium-kpi-card">
          <span className="premium-kpi-label">Gap vs. nicho ({gap.roasReferenceFormatted})</span>
          <span className="premium-kpi-value">{gap.gapMonthlyFormatted}</span>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Projeção 12 meses: {gap.gapAnnualFormatted}
          </span>
        </div>
      </div>
    </section>
  );
}
