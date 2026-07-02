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
  eyebrow: "Gestão de tráfego pago para e-commerce que quer escalar",
  headline: "Escale sua loja sem queimar dinheiro em mídia paga.",
  headlineHighlight: "Escale sua loja",
  subheadline:
    "Gestão de tráfego pago sob medida para e-commerces que já investem mais de R$ 5.000/mês em Meta, Google, TikTok e outras plataformas e querem escalar com ROAS, estrutura e execução.",
  microProof: "+R$ 30 milhões gerenciados · cases escalando de 5k para 50k+ de verba mantendo ROAS",
  bullets: [
    "Diagnóstico técnico da sua estrutura de campanhas antes de escalar",
    "Gestão diária de Meta, Google, TikTok e demais plataformas ativas",
    "Otimização de ROAS, CPA e criativos para escalar a verba sem perder rentabilidade",
    "Relatório semanal e canal direto com o gestor no WhatsApp",
  ],
  badges: ["Sem fidelidade", "Cancele quando quiser", "Resposta em 24h úteis"],
  cta: "Receber proposta de gestão",
  ctaLoading: "Enviando…",
  footnote: "Resposta em até 24h úteis. Seu contato é usado só para a proposta.",
};


export const form = {
  title: "Solicite uma proposta para escalar sua loja",
  subtitle: "Preencha em 1 minuto. Douglas analisa sua operação e responde com um plano de escala.",
  trustBadges: [
    { label: "Dados protegidos" },
    { label: "Resposta em 24h úteis" },
    { label: "Sem fidelidade" },
  ],
  step1Cta: "Continuar",
  step2Back: "Voltar",
  stepLabels: { one: "1 · Contato", two: "2 · Sua loja" },
  budgetHint: {
    low: "Abaixo de R$ 5.000/mês, a gestão de R$ 4.997 dificilmente compensa. Você pode enviar assim mesmo — vamos ser diretos se recomendarmos esperar ganhar escala.",
  },
  fields: {
    name: { label: "Nome completo", placeholder: "Seu nome" },
    email: { label: "E-mail", placeholder: "voce@loja.com.br" },
    phone: { label: "WhatsApp", placeholder: "(11) 99999-9999" },
    storeName: { label: "Nome da loja", placeholder: "Loja Exemplo" },
    website: { label: "Site ou Instagram da loja", placeholder: "https://loja.com.br ou @loja" },
    budget: {
      label: "Quanto investe por mês em mídia paga (somando todas as plataformas)?",
      placeholder: "Selecione a faixa",
    },
    challenge: {
      label: "Qual o maior desafio hoje?",
      placeholder: "Ex.: ROAS caiu ao escalar, Google trava, TikTok com CPA alto, falta estrutura para dobrar a verba…",
    },
  },
  budgetOptions: [
    { value: "<5k", label: "Menos de R$ 5.000" },
    { value: "5k-15k", label: "R$ 5.000 a R$ 15.000" },
    { value: "15k-50k", label: "R$ 15.000 a R$ 50.000" },
    { value: ">50k", label: "Mais de R$ 50.000" },
  ],
  consent: "Concordo em receber contato sobre a proposta de gestão. Seus dados não serão compartilhados.",
  privacyLinkLabel: "política de privacidade",
  errors: {
    required: "Campo obrigatório",
    email: "E-mail inválido",
    phone: "WhatsApp inválido",
    url: "Informe um site ou @ Instagram válido",
  },
  success: {
    title: "Proposta solicitada",
    body: "Recebemos seus dados. Douglas vai analisar sua operação e responder em até 24h úteis com uma proposta de escala.",
    cta: "Falar no WhatsApp agora",
    ctaHint: "Se quiser adiantar, clique para iniciar a conversa.",
  },
};


export const howItWorksSection = {
  eyebrow: "Como funciona",
  title: "De lead à operação escalando em poucos dias",
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
      description: "Plano de ação, investimento, prazo de início e projeção de escala nos primeiros 30 dias.",
    },
    {
      step: 4,
      title: "Iniciamos a gestão",
      description: "Acesso, briefing, metas e as primeiras otimizações para escala em até 5 dias úteis.",
    },
  ],
};

export const qualificationSection = {
  eyebrow: "Para quem é",
  title: "Feito para e-commerce que quer escalar com tráfego pago",
  forYou: [
    "Loja de e-commerce físico vendendo no Brasil",
    "Investe pelo menos R$ 5.000/mês em mídia paga (Meta, Google, TikTok etc.)",
    "Já tem campanhas rodando em pelo menos uma plataforma paga",
    "Quer escalar a verba de mídia paga mantendo ou melhorando o ROAS",
    "Quer um gestor dedicado cuidando de todos os canais, não uma agência por plataforma",
    "Está disposto a executar mudanças rápidas com base em dados",
  ],
  notForYou: [
    "Infoprodutos, serviços ou afiliados",
    "Lojas que ainda não investem em tráfego pago",
    "Quem procura só relatório, sem execução",
    "Quem não tem pelo menos R$ 5.000/mês de verba de mídia — a gestão não compensa nessa escala",
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
      question: "Preciso pagar alguma coisa antes de receber a proposta?",
      answer:
        "Não. Preencher o formulário e receber a proposta não tem custo nem compromisso. Você só paga se decidir seguir com a gestão mensal.",
    },
    {
      question: "Quanto tempo leva para começar a gestão?",
      answer:
        "Após aprovar a proposta, fazemos o onboarding em até 24h e as primeiras otimizações em até 5 dias úteis.",
    },
    {
      question: "Como funciona o contrato?",
      answer:
        "Mensalidade de R$ 1.997, sem fidelidade. Você pode cancelar antes do próximo ciclo de cobrança avisando pelo WhatsApp.",
    },
    {
      question: "Quais plataformas de mídia paga vocês gerenciam?",
      answer:
        "Meta Ads (Facebook e Instagram), Google Ads (Search, Shopping, PMax, YouTube), TikTok Ads e outras plataformas conforme a operação da sua loja. Um único gestor cuidando de todos os canais ativos.",
    },
    {
      question: "Quais acessos são necessários?",
      answer:
        "Depende dos canais ativos: Business Manager e Pixel/CAPI (Meta), Google Ads e Merchant Center, TikTok Ads Manager, GA4 e acesso ao Shopify/e-commerce. Tudo com permissões mínimas e seguras.",
    },
    {
      question: "Vocês garantem ROAS?",
      answer:
        "Não garantimos um número específico de ROAS, porque o resultado depende de fatores fora do nosso controle (oferta, ticket médio, sazonalidade, concorrência). O que garantimos é processo: diagnóstico técnico, execução diária e otimização baseada em dados, com transparência total sobre o que está sendo feito e por quê.",
    },
  ],
};

export const finalCta = {
  title: "Antes de investir mais um real em mídia, olhe pra sua conta com quem entende de estrutura, não só de criativo.",
  body: "Preencha o formulário e receba uma proposta de gestão de mídia paga (Meta, Google, TikTok e outras) feita para a sua operação — sem compromisso.",
  cta: "Receber proposta de gestão",
};

export const seo = {
  title: "Gestão de Tráfego Pago (Meta, Google, TikTok) para E-commerce | Agency Opus",
  description:
    "Gestão de mídia paga para e-commerce que investe R$ 5k+/mês: Meta, Google, TikTok e outras plataformas com um único gestor. Receba uma proposta sob medida.",
};

export const anchors = {
  comoFunciona: "como-funciona",
  prova: "prova",
  faq: "faq",
  marcas: "marcas",
};

export const clientsSection = {
  eyebrow: "Marcas atendidas",
  title: "Lojas que já passaram pela nossa gestão",
  subtitle: "E-commerces que confiaram a operação de mídia paga.",
  footnote: "Trabalho realizado como gestor no Grupo Moon.",
  items: [
    { name: "Mixed", niche: "MODA FEMININA" },
    { name: "Fillity", niche: "MODA FEMININA" },
    { name: "La Rouge", niche: "LINGERIE E SLEEPWEAR DE LUXO\u00a0" },
    { name: "Paula Ferber", niche: "SAPATO E BOLSAS ARTESANAIS\u00a0" },
    { name: "Carolina Etz", niche: "MODA FEMININA" },
    { name: "Linea", niche: "SUPLEMENTO" },
  ],
};

export const problemsSection = {
  eyebrow: "O diagnóstico começa aqui",
  title: "Você reconhece algum desses problemas?",
  subtitle: "Se pelo menos dois soam familiares, faz sentido conversar.",
  items: [
    "ROAS despencou nos últimos meses e ninguém sabe explicar o porquê",
    "CPM não para de subir e come toda a margem da campanha",
    "Escala trava sempre no mesmo teto de faturamento mensal",
    "Criativos morrem em poucos dias e falta processo pra repor",
    "Sem visibilidade real do que está acontecendo dentro da conta",
  ],
};

export const operatorSection = {
  eyebrow: "Quem vai cuidar da sua conta",
  title: "Um gestor dedicado, não uma agência genérica",
  bullets: [
    "Com passagem por operações de e-commerce de alto ticket",
    "+R$ 30 milhões gerenciados em Meta Ads e Google Ads",
    "5 anos focados exclusivamente em e-commerce",
    "Atendimento direto no WhatsApp, sem intermediário de gerente de contas",
  ],
};
