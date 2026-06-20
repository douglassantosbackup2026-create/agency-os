export const GESTAO_PRODUCT_NAME = "Gestão de Tráfego Meta Ads";
export const GESTAO_PRODUCT_TAGLINE =
  "Execução diária do plano do seu diagnóstico — equipe especializada";

export const GESTAO_DELIVERABLES = [
  "Implementação das correções prioritárias do relatório",
  "Gestão diária de campanhas, criativos e públicos",
  "Otimização contínua de ROAS, CPA e estrutura de conta",
  "Testes A/B de criativos e ofertas com critério de escala",
  "Relatórios de performance e alinhamento estratégico",
  "Canal direto com gestor (WhatsApp) para decisões rápidas",
  "Foco em recuperar receita identificada no diagnóstico",
];

export const GESTAO_GUARANTEE =
  "Sem fidelidade. Cancele quando quiser — basta avisar pelo WhatsApp antes do próximo ciclo mensal.";

export const GESTAO_RECURRENCE_NOTE_PIX =
  "Pix paga a 1ª mensalidade hoje. Nos meses seguintes, enviamos um novo link de Pix pelo WhatsApp 3 dias antes do vencimento — você decide quando confirmar.";

export const GESTAO_RECURRENCE_NOTE_CARD =
  "Cartão ativa a cobrança automática mensal de R$ 1.997 pelo Mercado Pago. A 1ª cobrança acontece agora; as próximas são automáticas todo mês na mesma data. Cancele quando quiser.";

export const GESTAO_PAYMENT_METHOD_HINTS = {
  pix: "Renovação manual",
  card: "Renovação automática",
} as const;

export const GESTAO_CARD_CONSENT =
  "Autorizo o Mercado Pago a cobrar R$ 1.997 mensalmente no meu cartão até eu cancelar.";

export const DEFAULT_MANAGEMENT_PRICE_CENTS = 199700;

export function formatManagementPrice(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function gestaoUrgencyText(): string {
  return (
    import.meta.env.VITE_GESTAO_URGENCY_TEXT?.trim() ||
    "Condição especial para as próximas 2 operações"
  );
}

export const GESTAO_AVAILABLE_SLOTS = Number(
  import.meta.env.VITE_GESTAO_AVAILABLE_SLOTS ?? 2,
);

export const GESTAO_OPERATOR = {
  name: "Douglas Santos",
  role: "Gestor responsável pela sua conta",
  credentialLine:
    "Ex-Ogilvy · +R$ 30 milhões gerenciados em Meta e Google Ads · 5 anos focados em e-commerce",
  initials: "DS",
};

export const GESTAO_TESTIMONIAL = {
  quote:
    "Em 2 meses saímos do vermelho para 5 dígitos de lucro. O Douglas mexeu na estrutura inteira da conta, não só nos criativos.",
  author: "Marina L.",
  role: "CEO — moda feminina",
  metric: "ROAS 2,1× → 8,3× em 60 dias",
};

export const GESTAO_NEXT_STEPS: { title: string; description: string }[] = [
  {
    title: "Confirmação imediata",
    description: "Você recebe o comprovante por e-mail assim que o pagamento cai.",
  },
  {
    title: "Onboarding em até 24h",
    description:
      "Douglas chama você no WhatsApp para alinhar acessos, metas e prioridades do mês.",
  },
  {
    title: "Campanhas no ar em até 5 dias úteis",
    description:
      "Implementação das correções prioritárias do diagnóstico e início da otimização contínua.",
  },
];
