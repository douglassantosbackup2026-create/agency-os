/** Preço gestão lead direto (/gestao-trafego). Override: VITE_LEAD_MANAGEMENT_PRICE_CENTS. */
export const LEAD_MANAGEMENT_PRICE_CENTS = Number(
  import.meta.env.VITE_LEAD_MANAGEMENT_PRICE_CENTS ?? 499700,
);

export function formatLeadManagementPrice(cents = LEAD_MANAGEMENT_PRICE_CENTS): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function leadManagementPriceBrl(cents = LEAD_MANAGEMENT_PRICE_CENTS): number {
  return cents / 100;
}

export function leadCardConsentLabel(priceLabel: string): string {
  return `Autorizo o Mercado Pago a cobrar ${priceLabel} mensalmente no meu cartão até eu cancelar.`;
}

export function leadRecurrenceNoteCard(priceLabel: string): string {
  return `Cartão ativa a cobrança automática mensal de ${priceLabel} pelo Mercado Pago. A 1ª cobrança acontece agora; as próximas são automáticas todo mês na mesma data. Cancele quando quiser.`;
}

/** Mapeia faixa de investimento do lead para budget mensal estimado (BRL). */
export function budgetFromLeadRange(range: string): number {
  switch (range) {
    case "<5k":
      return 3000;
    case "5k-15k":
      return 10000;
    case "15k-50k":
      return 30000;
    case ">50k":
      return 75000;
    default:
      return 0;
  }
}
