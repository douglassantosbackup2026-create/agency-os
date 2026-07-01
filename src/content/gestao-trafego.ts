import {
  GESTAO_DELIVERABLES,
  GESTAO_GUARANTEE,
  GESTAO_OPERATOR,
  GESTAO_RESULT_PROOFS,
  GESTAO_TESTIMONIAL,
  formatManagementPrice,
  DEFAULT_MANAGEMENT_PRICE_CENTS,
} from "@/content/gestao-checkout";

export { GESTAO_DELIVERABLES, GESTAO_GUARANTEE, GESTAO_OPERATOR, GESTAO_RESULT_PROOFS, GESTAO_TESTIMONIAL };

export const GESTAO_PRICE_LABEL = formatManagementPrice(DEFAULT_MANAGEMENT_PRICE_CENTS);

export const hero = {
  eyebrow: "Gestão de Tráfego Pago para e-commerce",
  headline: "Pare de queimar dinheiro em mídia paga.",
  headlineHighlight: "queimar dinheiro",
  subheadline:
    "Gestão de tráfego pago sob medida para e-commerces que investem mais de R$ 5.000/mês em mídia paga — Meta, Google, TikTok e outras plataformas. Foco em ROAS, escala e execução sem enrolação.",
  bullets: [
    "Diagnóstico técnico das suas contas antes de começar",
    "Gestão diária de Meta, Google, TikTok e demais plataformas ativas",
    "Otimização de campanhas, criativos e públicos em todos os canais",
    "Relatório semanal de performance e próximos passos",
    "Canal direto com gestor via WhatsApp",
    "Sem fidelidade — cancele quando quiser",
  ],
  cta: "Receber proposta de gestão",
  ctaLoading: "Enviando…",
  footnote: "Resposta em até 24h úteis. Seu contato é usado só para a proposta.",
};

export const form = {
  title: "Solicite uma proposta para sua loja",
  subtitle: "Preencha em 1 minuto. Douglas analisa sua operação e responde com a proposta.",
  fields: {
    name: { label: "Nome completo", placeholder: "Seu nome" },
    email: { label: "E-mail", placeholder: "voce@loja.com.br" },
    phone: { label: "WhatsApp", placeholder: "(11) 99999-9999" },
    storeName: { label: "Nome da loja", placeholder: "Loja Exemplo" },
    website: { label: "Site ou Instagram da loja", placeholder: "https://loja.com.br ou @loja" },
    budget: { label: "Quanto investe por mês em mídia paga (somando todas as plataformas)?" },
    challenge: {
      label: "Qual o maior desafio hoje?",
      placeholder: "Ex.: ROAS do Meta caiu, Google não escala, TikTok com CPA alto…",
    },
  },
  budgetOptions: [
    { value: "<5k", label: "Menos de R$ 5.000" },
    { value: "5k-15k", label: "R$ 5.000 a R$ 15.000" },
    { value: "15k-50k", label: "R$ 15.000 a R$ 50.000" },
    { value: ">50k", label: "Mais de R$ 50.000" },
  ],
  consent: "Concordo em receber contato sobre a proposta de gestão. Seus dados não serão compartilhados.",
  errors: {
    required: "Campo obrigatório",
    email: "E-mail inválido",
    phone: "WhatsApp inválido",
    url: "Informe um site ou @ Instagram válido",
  },
  success: {
    title: "Proposta solicitada",
    body: "Recebemos seus dados. Douglas vai analisar sua operação e responder em até 24h úteis.",
    cta: "Falar no WhatsApp agora",
    ctaHint: "Se quiser adiantar, clique para iniciar a conversa.",
  },
};

export const howItWorksSection = {
  eyebrow: "Como funciona",
  title: "De lead à operação no ar em poucos dias",
  steps: [
    {
      step: 1,
      title: "Você preenche o formulário",
      description: "Nome, contato, site da loja e quanto investe em mídia.",
    },
    {
      step: 2,
      title: "Douglas analisa sua conta",
      description: "Avaliamos sua estrutura de campanhas, criativos e números — sem compromisso.",
    },
    {
      step: 3,
      title: "Você recebe a proposta",
      description: "Plano de ação, investimento, prazo de início e o que esperar nos primeiros 30 dias.",
    },
    {
      step: 4,
      title: "Iniciamos a gestão",
      description: "Acesso, briefing, metas e as primeiras otimizações em até 5 dias úteis.",
    },
  ],
};

export const qualificationSection = {
  eyebrow: "Para quem é",
  title: "Feito para um perfil específico de e-commerce",
  forYou: [
    "Loja de e-commerce físico vendendo no Brasil",
    "Investe pelo menos R$ 5.000/mês em Meta Ads",
    "Já tem campanhas rodando ou rodou nos últimos 30 dias",
    "Quer um gestor dedicado, não uma agência genérica",
    "Está disposto a executar mudanças rápidas com base em dados",
  ],
  notForYou: [
    "Infoprodutos, serviços ou afiliados",
    "Lojas que não investem em tráfego pago",
    "Quem procura só relatório, sem execução",
  ],
};

export const includedSection = {
  eyebrow: "O que está incluído",
  title: `Gestão completa por ${GESTAO_PRICE_LABEL}/mês`,
  items: GESTAO_DELIVERABLES,
};

export const guaranteeSection = {
  eyebrow: "Garantia",
  title: "Sem fidelidade, sem surpresa",
  body: GESTAO_GUARANTEE,
};

export const faqSection = {
  eyebrow: "Dúvidas",
  title: "Perguntas frequentes",
  items: [
    {
      question: "Quanto tempo leva para começar a gestão?",
      answer:
        "Após aprovar a proposta, fazemos o onboarding em até 24h e as primeiras otimizações em até 5 dias úteis.",
    },
    {
      question: "Preciso fazer o diagnóstico de R$37 antes?",
      answer:
        "Não é obrigatório, mas ajuda. Se já fez o diagnóstico, a proposta será mais cirúrgica. Se não fez, analisamos a conta durante a proposta.",
    },
    {
      question: "Como funciona o contrato?",
      answer:
        "Mensalidade de R$ 1.997, sem fidelidade. Você pode cancelar antes do próximo ciclo de cobrança avisando pelo WhatsApp.",
    },
    {
      question: "Quais acessos são necessários?",
      answer:
        "Business Manager, conta de anúncios, catálogo de produtos, Pixel/CAPI e acesso ao Shopify/e-commerce. Tudo com permissões mínimas e seguras.",
    },
    {
      question: "Vocês garantem ROAS?",
      answer:
        "Nenhum gestor sério garante ROAS. O que garantimos é execução técnica, transparência nos números e ajustes baseados em dados — com relatório semanal.",
    },
  ],
};

export const finalCta = {
  title: "Vamos olhar sua conta antes de você gastar mais nada em mídia",
  body: "Preencha o formulário e receba uma proposta de gestão feita para a sua operação.",
  cta: "Receber proposta de gestão",
};

export const seo = {
  title: "Gestão de Tráfego Meta Ads para E-commerce | Agency Opus",
  description:
    "Receba uma proposta de gestão de tráfego pago para sua loja. Especialista em Meta Ads para e-commerce com resultados comprovados.",
};

export const anchors = {
  comoFunciona: "como-funciona",
  prova: "prova",
  faq: "faq",
};
