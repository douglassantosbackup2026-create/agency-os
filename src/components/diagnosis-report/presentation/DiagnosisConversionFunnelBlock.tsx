import type { ConversionFunnelView } from "../types";

type Props = {
  funnel: ConversionFunnelView;
};

function rateLabel(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function alertCopy(funnel: ConversionFunnelView): { tone: "warn" | "info"; text: string } | null {
  const r = funnel.revenueAtRiskMonthlyBrl;
  const brl = r
    ? `R$ ${r.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês`
    : null;
  switch (funnel.bottleneck) {
    case "checkout_late":
      return {
        tone: "warn",
        text:
          `Abandono na finalização (após inserir pagamento). ` +
          (brl ? `Impacto indicativo: ${brl}. ` : "") +
          `Quase sempre é gateway recusando cartões, falta de Pix/parcelamento, frete-surpresa no último passo ou erro técnico. ` +
          `Quem chegou aqui já decidiu comprar — é o gargalo mais caro de ignorar.`,
      };
    case "checkout_early":
      return {
        tone: "warn",
        text:
          `Abandono no início do checkout — antes mesmo do pagamento. ` +
          (brl ? `Impacto indicativo: ${brl}. ` : "") +
          `Causas prováveis: frete revelado tarde, login obrigatório ou fricção na primeira tela.`,
      };
    case "checkout":
      return {
        tone: "warn",
        text:
          `Gargalo no checkout do site — nenhuma otimização só de anúncio resolve. ` +
          (brl ? `Impacto indicativo: ${brl}. ` : "") +
          (funnel.paymentInfoTracked === false
            ? `Evento add_payment_info não rastreado — instale no Pixel/CAPI para distinguir abandono antes vs depois do pagamento.`
            : ""),
      };
    case "atc":
      return brl
        ? { tone: "warn", text: `Abandono entre carrinho e checkout. Impacto indicativo: ${brl}.` }
        : null;
    default:
      return null;
  }
}

export function DiagnosisConversionFunnelBlock({ funnel }: Props) {
  const showPaymentInfo = funnel.paymentInfoTracked === true;
  const steps = [
    { label: "Landing page views", value: funnel.lpv, rate: null as number | null },
    { label: "Add to cart", value: funnel.atc, rate: funnel.atcRate },
    { label: "Checkout iniciado", value: funnel.checkout, rate: funnel.checkoutRate },
    ...(showPaymentInfo
      ? [
          {
            label: "Inseriu pagamento",
            value: funnel.paymentInfo ?? 0,
            rate: funnel.paymentInfoRate ?? null,
          },
        ]
      : []),
    {
      label: "Compras",
      value: funnel.purchase,
      rate: showPaymentInfo ? (funnel.purchaseFromPaymentRate ?? null) : funnel.purchaseRate,
    },
  ];

  const alert = alertCopy(funnel);

  return (
    <section className="card presentation-layout-section" id="bloco-funil">
      <p className="presentation-section-eyebrow">04 · Funil de conversão</p>
      <h2 className="premium-section-title">Do clique à compra</h2>
      <p className="premium-section-hint muted">{funnel.bottleneckLabel}</p>
      {alert ? (
        <p className="premium-alert-box premium-featured-alert">{alert.text}</p>
      ) : null}
      {!showPaymentInfo && funnel.bottleneck.startsWith("checkout") ? (
        <p className="muted" style={{ fontSize: "0.82rem", marginTop: "-0.25rem" }}>
          Evento <code>add_payment_info</code> não rastreado — não é possível subdividir o
          funil pós-checkout. Instale o evento no Pixel/CAPI para isolar se o abandono é antes
          ou depois do pagamento.
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
