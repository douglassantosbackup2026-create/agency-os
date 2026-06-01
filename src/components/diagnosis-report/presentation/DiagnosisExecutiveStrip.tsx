import type { DiagnosisAnalysis, FinancialBalance, TopFinding } from "../types";

type Props = {
  balance: FinancialBalance | null;
  analysis: DiagnosisAnalysis;
  topFinding: TopFinding | null;
};

export function DiagnosisExecutiveStrip({ balance, analysis, topFinding }: Props) {
  const fi = analysis.financialImpact;
  const revenueFormatted = balance?.revenueFormatted ?? fi?.revenueFormatted;
  const roasValue = fi?.roasFormatted ?? "—";
  const hasRoas = Boolean(roasValue && roasValue !== "—");
  const roasSub = hasRoas && revenueFormatted
    ? `Receita rastreada: ${revenueFormatted}`
    : !hasRoas
      ? "Sem eventos de compra rastreados no período — ROAS só em campanhas de Vendas."
      : null;

  const kpis = [
    {
      label: "Investimento (30d)",
      value: balance?.investedFormatted ?? fi?.spendFormatted ?? "—",
      sub: null as string | null,
    },
    {
      label: "ROAS Vendas",
      value: hasRoas ? roasValue : "—",
      sub: roasSub,
    },
    {
      label: "Em risco / mês",
      value: (() => {
        const v = balance?.atRiskFormatted ?? fi?.lossMonthlyFormatted ?? "—";
        return v && v !== "—" ? v : "—";
      })(),
      sub: null as string | null,
    },
  ];

  const mainProblem =
    topFinding?.headline ??
    analysis.executiveSummary?.risks?.[0] ??
    analysis.criticalIssues?.[0]?.title;

  return (
    <section className="card presentation-layout-section" id="resumo-executivo">
      <p className="presentation-section-eyebrow">01 · Resumo executivo</p>
      <h2 className="premium-section-title">Números do período</h2>
      <p className="premium-section-hint muted">
        Últimos 30 dias na Meta — valores calculados no servidor.
      </p>

      {mainProblem ? (
        <div className="premium-alert-box premium-featured-alert">
          <strong>Principal problema:</strong> {mainProblem}
          {topFinding?.monthlyImpactFormatted &&
          topFinding.monthlyImpactFormatted !== "—" &&
          (topFinding.monthlyImpactBrl ?? 0) > 0
            ? ` — impacto indicativo ${topFinding.monthlyImpactFormatted}/mês.`
            : null}
        </div>
      ) : null}

      <div className="premium-grid-3">
        {kpis.map((k) => (
          <div key={k.label} className="premium-kpi-card">
            <span className="premium-kpi-label">{k.label}</span>
            <span className="premium-kpi-value">{k.value}</span>
            {k.sub ? (
              <span className="muted" style={{ fontSize: "0.78rem", display: "block", marginTop: "0.2rem" }}>
                {k.sub}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
