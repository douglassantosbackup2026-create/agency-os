import type { MetaSeniorDerived } from "../types";

type Props = {
  meta: MetaSeniorDerived;
};

export function DiagnosisAccountHealthStrip({ meta }: Props) {
  const { opportunityScore, accountSummary } = meta;
  const scoreLabel =
    opportunityScore >= 75
      ? "Conta com boa base"
      : opportunityScore >= 55
        ? "Atenção em alguns eixos"
        : "Oportunidade de recuperação";

  return (
    <section className="card presentation-layout-section" id="sec-account-health">
      <p className="presentation-section-eyebrow">Meta · Saúde da conta</p>
      <h2 className="premium-section-title">Panorama do período</h2>
      <div className="premium-grid-3 meta-health-strip">
        <div className="premium-kpi-card">
          <span className="premium-kpi-label">Score de oportunidade</span>
          <span className="premium-kpi-value">{opportunityScore}/100</span>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            {scoreLabel}
          </span>
        </div>
        <div className="premium-kpi-card">
          <span className="premium-kpi-label">Foco principal</span>
          <span className="premium-kpi-value">{accountSummary.primaryObjectiveLabel}</span>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            {accountSummary.mixedFunnel ? "Funil misto (topo + fundo)" : "Objetivo dominante"}
          </span>
        </div>
        <div className="premium-kpi-card">
          <span className="premium-kpi-label">Alertas críticos</span>
          <span className="premium-kpi-value">{accountSummary.anomalyCount}</span>
          <span className="muted" style={{ fontSize: "0.78rem" }}>
            Eixos em estado crítico no funil
          </span>
        </div>
      </div>
    </section>
  );
}
