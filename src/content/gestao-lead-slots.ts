/** Cap mensal do funil /gestao-trafego (fallback quando API indisponível). */
export const LEAD_FUNNEL_MONTHLY_CAP = Number(
  import.meta.env.VITE_LEAD_FUNNEL_MONTHLY_CAP ?? 3,
);

/** Base da fila de espera exibida (28 + leads reais aguardando). */
export const LEAD_WAITLIST_BASE = Number(
  import.meta.env.VITE_LEAD_WAITLIST_BASE_COUNT ?? 28,
);

export type LeadSlotsSnapshot = {
  cap: number;
  used: number;
  available: number;
  waitlist_display?: number;
};

export function computeAvailableSlots(cap: number, used: number): number {
  return Math.max(0, cap - used);
}

export function computeWaitlistDisplay(base: number, pendingCount: number): number {
  return base + Math.max(0, pendingCount);
}

export function formatLeadSlotsBadge(available: number): string {
  if (available <= 0) return "Vagas esgotadas este mês";
  if (available === 1) return "Apenas 1 vaga disponível neste mês";
  return `Apenas ${available} vagas este mês`;
}

export function formatLeadSlotsMetaTitle(available: number): string {
  if (available <= 0) {
    return "Proposta recebida — vagas esgotadas este mês";
  }
  return `Proposta recebida — garanta sua vaga (só ${available} ${available === 1 ? "vaga" : "vagas"} este mês)`;
}

export function formatLeadSlotsMetaDescription(
  available: number,
  priceLabel: string,
): string {
  if (available <= 0) {
    return `Vagas esgotadas. ${priceLabel}/mês, sem fidelidade. Fale no WhatsApp para lista de espera.`;
  }
  return `Só ${available} ${available === 1 ? "vaga" : "vagas"} por mês. ${priceLabel}/mês, sem fidelidade. Pague no cartão ou Pix e garanta a sua agora.`;
}

export function leadSlotsWhatsAppLine(available: number, priceLabel: string): string {
  if (available <= 0) {
    return `Olá! Enviei a proposta no site, mas vi que as vagas deste mês esgotaram. Quero entrar na lista de espera para gestão de tráfego (${priceLabel}/mês).`;
  }
  return `Olá! Acabei de enviar a proposta no site e quero garantir uma das ${available} vagas deste mês para a gestão de tráfego (${priceLabel}/mês). Podemos começar?`;
}

export function formatLeadSlotsCapLine(cap: number): string {
  return `Eu abro apenas ${cap} vagas por mês para operações de e-commerce que querem escalar. Quem paga primeiro, entra.`;
}

export function formatLeadWaitlistUrgency(
  waitlistDisplay: number,
  _available?: number,
): { headline: string; subline: string } {
  const waitlistLabel =
    waitlistDisplay === 1 ? "1 e-commerce" : `${waitlistDisplay} e-commerces`;

  return {
    headline: `${waitlistLabel} já solicitaram proposta este mês.`,
    subline: "",
  };
}
