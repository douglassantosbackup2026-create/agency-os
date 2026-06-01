import type { DeliverySummary } from "../types";

type Props = {
  summary: DeliverySummary;
};

export function DiagnosisDeliveryStatusBlock({ summary }: Props) {
  return (
    <section className="card presentation-layout-section" id="bloco-entrega">
      <p className="presentation-section-eyebrow">02 · Status de entrega</p>
      <h2 className="premium-section-title">Onde o Meta não está otimizando</h2>
      <p className="premium-section-hint muted">
        {summary.totalAdsets} conjuntos analisados · {summary.pctSpendNonOptimized}% do budget em
        modo não otimizado ({summary.spendNonOptimizedFormatted}/mês)
      </p>
      <p style={{ margin: "0.75rem 0 0", lineHeight: 1.55 }}>{summary.summaryPt}</p>
      <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
        Estimativa ~{summary.estimatedDailyBlindSpendFormatted}/dia sem aprendizado pleno.
      </p>
    </section>
  );
}
