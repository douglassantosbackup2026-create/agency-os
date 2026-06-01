import type { ConversionFunnelView } from "../types";

type Props = {
  funnel: ConversionFunnelView;
};

function rateLabel(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

export function DiagnosisConversionFunnelBlock({ funnel }: Props) {
  const steps = [
    { label: "Landing page views", value: funnel.lpv, rate: null },
    { label: "Add to cart", value: funnel.atc, rate: funnel.atcRate },
    { label: "Checkout iniciado", value: funnel.checkout, rate: funnel.checkoutRate },
    { label: "Compras", value: funnel.purchase, rate: funnel.purchaseRate },
  ];

  return (
    <section className="card presentation-layout-section" id="bloco-funil">
      <p className="presentation-section-eyebrow">04 · Funil de conversão</p>
      <h2 className="premium-section-title">Do clique à compra</h2>
      <p className="premium-section-hint muted">{funnel.bottleneckLabel}</p>
      {funnel.bottleneck === "checkout" && funnel.revenueAtRiskMonthlyBrl ? (
        <p className="premium-alert-box premium-featured-alert">
          O gargalo está no checkout do site — nenhuma otimização só de anúncio resolve. Impacto
          indicativo: R${" "}
          {funnel.revenueAtRiskMonthlyBrl.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          /mês com taxa saudável de finalização.
        </p>
      ) : null}
      <div className="funnel-steps-row">
        {steps.map((s, i) => (
          <div key={s.label} className="funnel-step-card">
            <span className="premium-kpi-label">{s.label}</span>
            <span className="premium-kpi-value">{s.value.toLocaleString("pt-BR")}</span>
            {s.rate != null && i > 0 ? (
              <span className="muted" style={{ fontSize: "0.78rem" }}>
                Taxa: {rateLabel(s.rate)}
              </span>
            ) : null}
            {i < steps.length - 1 ? <span className="funnel-arrow">→</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
