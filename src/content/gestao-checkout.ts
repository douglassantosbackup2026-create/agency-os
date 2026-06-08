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
  "Onboarding estruturado com base no seu diagnóstico — sem promessas vazias de milagre.";

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
