/** Copy da landing pública — Diagnóstico Meta Ads (estrutura 4 perguntas). */

export const ANCHOR_O_QUE_E = "o-que-e";
export const ANCHOR_PARA_QUEM = "para-quem";
export const ANCHOR_O_QUE_FAZ = "o-que-faz";
export const ANCHOR_COMO = "como-funciona";
export const ANCHOR_PREVIEW = "preview-relatorio";
export const ANCHOR_AUTOR = "quem-faz";
export const ANCHOR_RESULTADOS = "resultados";
export const ANCHOR_GARANTIA = "garantia";
export const ANCHOR_FAQ = "faq";

export const PRICE_LABEL = "R$ 37";
export const PRICE_ANCHOR_LABEL = "R$ 199,90";
export const PRICE_DISPLAY_TEXT = `de ${PRICE_ANCHOR_LABEL} por ${PRICE_LABEL}`;

/** Amostra v12 — maturidade, vazamento e crescimento para preview da landing. */
const PREVIEW_LEAK_MONTHLY_BRL = 4_200;

export const seniorReportPreview = {
  maturityLevel: 3,
  maturityLabel: "Intermediário",
  leakMonthlyFormatted: "R$ 4.200",
  leakMonthlyBrl: PREVIEW_LEAK_MONTHLY_BRL,
  growthProbablePct: 18,
  growthProbableFormatted: "+18%",
};

/** Amostra visual do relatório executivo na landing (conta demo anonimizada). */
export const reportPreviewDemo = {
  score: 43,
  scoreLabel: "Necessita atenção",
  heroOpportunityRange: "R$ 4.200 – R$ 8.400",
  stats: {
    invested: {
      label: "Investimento analisado",
      value: "R$ 28.400",
      hint: "Últimos 30 dias",
    },
    revenue: {
      label: "Receita gerada",
      value: "R$ 79.520",
      hint: "ROAS 2,8x",
      positive: true,
    },
    potential: {
      label: "Potencial identificado",
      value: "R$ 8.400",
      hint: "Recuperável em 60–90 dias",
      accent: true,
    },
    gap: {
      label: "Gap de crescimento",
      value: "R$ 4.200",
      hint: "Por mês — se nada mudar",
      negative: true,
    },
  },
  topLeak: {
    title: "Campanha de Vendas com ROAS abaixo do ideal",
    impact: "−R$ 2.400/mês",
    body: "62% do gasto concentrado em 1 conjunto com frequência alta e CTR em queda.",
  },
  topOpp: {
    title: "Renovar criativos nos top 3 conjuntos",
    impact: "+R$ 3.200/mês",
    body: "Benchmark do nicho indica headroom de +18% com novos formatos UGC.",
  },
  leaks: [
    {
      title: "Campanha Vendas — ROAS 1,9x vs ideal 5x",
      impact: "−R$ 2.400/mês",
      priority: "Alta",
    },
    {
      title: "CTR 0,7% (referência ≥ 2%) em 4 anúncios do top gasto",
      impact: "−R$ 1.100/mês",
      priority: "Alta",
    },
    {
      title: "CPM R$ 67 vs referência R$ 32 do nicho",
      impact: "−R$ 700/mês",
      priority: "Média",
    },
  ],
  totalLeakFormatted: "R$ 4.200",
  pillars: [
    { label: "Estrutura", score: 38 },
    { label: "Criativo", score: 29 },
    { label: "Públicos", score: 61 },
    { label: "Escala", score: 44 },
    { label: "Financeiro", score: 35 },
  ],
  benchmarks: [
    {
      metric: "ROAS",
      yours: "2,8x",
      market: "4,2x",
      top10: "6,0x",
      delta: "−53%",
      bad: true,
    },
    {
      metric: "CPM",
      yours: "R$ 67",
      market: "R$ 45",
      top10: "R$ 32",
      delta: "+49%",
      bad: true,
    },
    {
      metric: "CTR",
      yours: "0,7%",
      market: "1,4%",
      top10: "2,1%",
      delta: "−50%",
      bad: true,
    },
  ],
  benchmarkNiche: "E-commerce — moda & lifestyle",
  roadmapPhases: [
    {
      phase: "Fase 1",
      title: "Estancar perdas",
      eta: "Semana 1–2",
      items: [
        "Pausar conjuntos com ROAS < 2x",
        "Cortar overlap entre campanhas de prospecção",
        "Excluir compradores dos públicos frios",
      ],
    },
    {
      phase: "Fase 2",
      title: "Otimizar base",
      eta: "Semana 3–4",
      items: [
        "Renovar criativos nos top 3 conjuntos",
        "Rebalancear budget para campanhas saudáveis",
        "Testar lookalike de compradores 60d",
      ],
    },
    {
      phase: "Fase 3",
      title: "Escalar com controle",
      eta: "Mês 2+",
      items: [
        "Incremento de 15–20% nas vencedoras",
        "Expandir formatos UGC validados",
        "Monitorar ROAS e frequência semanalmente",
      ],
    },
  ],
  projection: {
    before: [
      { label: "ROAS", value: "2,8x" },
      { label: "Receita/mês", value: "R$ 79,5k" },
      { label: "Vazamento", value: "R$ 4,2k" },
    ],
    after: [
      { label: "ROAS", value: "5,2x" },
      { label: "Receita/mês", value: "R$ 118k" },
      { label: "Vazamento", value: "R$ 1,1k" },
    ],
  },
  mockHeroSub:
    "Loja de e-commerce — campanhas, criativos e públicos · últimos 30 dias.",
};

export const hero = {
  eyebrow: "Diagnóstico Meta Ads para e-commerce",
  brandLabel: "Diagnóstico Meta Ads · E-commerce",
  headline: "Descubra EXATAMENTE onde você está perdendo dinheiro no Meta Ads",
  headlineHighlight: "perdendo dinheiro",
  subheadline:
    "Auditoria da sua loja de e-commerce, com os dados reais da sua conta.",
  priceLine: PRICE_DISPLAY_TEXT,
  supportingLines: [
    "Análise técnica com IA, feita por quem já gerenciou R$ 30 milhões em tráfego pago.",
  ],
  ctaPrimary: "Analisar minha conta agora",
  mockCaption:
    "Amostra anonimizada · seu relatório usa os dados da sua loja",
  trustBadges: [
    "Feito para e-commerce",
    "Pagamento seguro",
    "Garantia de 7 dias",
  ],
  stickyCtaLabel: `Analisar · ${PRICE_DISPLAY_TEXT}`,
};

export const reportPreviewSection = {
  eyebrow: "Amostra do relatório",
  title: "Veja o que o diagnóstico revela sobre sua loja",
  intro:
    "Recorte real do relatório: score, vazamentos em R$, benchmark do nicho e plano priorizado. Abaixo, uma conta demo anonimizada — o seu relatório usa os dados da sua conta.",
  footerNote:
    "+ módulos de criativos, públicos, oportunidades e projeção 30 dias — tudo interativo no navegador depois que você conecta a conta.",
  ctaSublabel: "Relatório completo em ~5 minutos",
};

export const whatIsSection = {
  eyebrow: "O que é",
  title: "Uma auditoria cirúrgica, não uma consultoria genérica",
  introParagraphs: [
    "Antes de gastar mais um real em mídia, vale entender o que você vai receber.",
    "É uma auditoria técnica da sua conta de Meta Ads (Facebook + Instagram), feita sobre os seus dados — não sobre boas práticas genéricas.",
    "Olhamos para:",
  ],
  dataPoints: [
    "Suas campanhas de vendas dos últimos 90 dias",
    "Seus criativos e a performance de cada um",
    "Seus públicos e segmentações",
    "Suas métricas comparadas com o mercado",
  ],
  resultsIntro: "No fim, você sabe:",
  results: [
    "Quais campanhas estão desperdiçando dinheiro",
    "Por que o ROAS não sobe",
    "Onde o CPM está alto demais",
    "Que ajustes fazer primeiro, com prioridade",
  ],
  summaryCalloutTitle: "Em resumo",
  summaryCalloutBody:
    "É um raio-X da operação de tráfego da loja: cada problema, quanto está custando e o que fazer. Tudo a partir dos seus números reais.",
};

export const forWhoSection = {
  eyebrow: "Para quem é",
  title: "Mas isso não serve para todo mundo",
  intro:
    "O diagnóstico foi desenhado para um perfil específico de operação. Confira antes de comprar.",
  forYouTitle: "É para você se",
  forYou: [
    "Você tem um e-commerce ativo vendendo produtos físicos",
    "Investe pelo menos R$ 5.000/mês em Meta Ads",
    "Já tem campanhas rodando ou rodou nos últimos 30 dias",
    "Está frustrado com ROAS baixo, CPM subindo ou conversões que não vêm",
    "Quer dados concretos sobre o que está errado — não achismo",
    `Topa investir ${PRICE_DISPLAY_TEXT} para descobrir se está perdendo milhares por mês`,
  ],
  notForYouTitle: "Não é para você se",
  notForYou: [
    "Você vende infoproduto, serviço ou afiliado (somos focados em e-commerce físico)",
    "Investe menos de R$ 5.000/mês (o diagnóstico funciona, mas o ROI é menor)",
    "Nunca rodou Meta Ads ou não tem dados recentes (precisamos de histórico)",
    "Está 100% satisfeito com os resultados atuais",
  ],
  importantCalloutTitle: "Por que esse corte importa",
  importantCalloutBody:
    "Em uma conta que investe R$ 10.000/mês, desperdiçar 30% são R$ 36.000 por ano. O diagnóstico custa de R$ 199,90 por R$ 37 — a conta fecha sozinha quando o problema existe.",
};

export type WhatItDoesModule = {
  number: number;
  title: string;
  description: string;
  example?: string;
};

export const whatItDoesSection = {
  eyebrow: "O que faz",
  title: "O que entra no relatório",
  subtitle:
    "Uma análise em 9 frentes — todas no mesmo relatório, na ordem em que você precisa ler.",
  modules: [
    {
      number: 1,
      title: "Score de saúde (0–100)",
      description:
        "Nota geral da conta a partir de critérios técnicos, com faixa (crítica, atenção, razoável, excelente).",
      example:
        'Ex.: "67/100 — atenção. Estrutura razoável, mas perdendo dinheiro em públicos saturados e criativos fracos."',
    },
    {
      number: 2,
      title: "Top 5 problemas críticos",
      description:
        "Os maiores ofensores da conta, com impacto quantificado em reais por mês.",
    },
    {
      number: 3,
      title: "Mapa de vazamentos de budget",
      description:
        "Onde cada real está indo: campanhas que sangram, conjuntos com ROAS baixo e onde cortar sem perder resultado.",
      example:
        'Ex.: "Conjunto Público Amplo Brasil — R$ 4.200 em 30 dias com ROAS 1,3x. Pausar e redirecionar para remarketing."',
    },
    {
      number: 4,
      title: "Análise de criativos",
      description:
        "Melhor e pior criativo (CTR, CPA, por quê) e o que testar a seguir.",
    },
    {
      number: 5,
      title: "Diagnóstico de públicos",
      description:
        "Saturação, sobreposição, funil (cold/warm/hot) e ajustes específicos por público.",
    },
    {
      number: 6,
      title: "Benchmarks do seu nicho",
      description:
        "Seus números (ROAS, CPM, CTR, CPA) comparados com o padrão do mercado e o top 10%.",
    },
    {
      number: 7,
      title: "Oportunidades priorizadas",
      description:
        "Melhorias ordenadas por impacto: quick wins, médio prazo e estratégicas — cada uma com ganho estimado.",
    },
    {
      number: 8,
      title: "Plano de ação detalhado",
      description:
        "O que fazer primeiro, depois e por último — com descrição, esforço e resultado esperado.",
    },
    {
      number: 9,
      title: "Projeção de melhoria em 30 dias",
      description:
        "ROAS atual vs. potencial, economia mensal estimada e nível de confiança da projeção.",
      example:
        'Ex.: "Com as otimizações, ROAS pode ir de 2,8x para 5,2x em 30–45 dias — +R$ 8.400 de lucro/mês."',
    },
  ] satisfies WhatItDoesModule[],
  bonusNote:
    "Relatório interativo no navegador — revise quando quiser, imprima ou salve como PDF.",
};

export type HowItWorksStep = {
  step: number;
  title: string;
  description: string;
  bullets?: string[];
  descriptionAfterBullets?: string;
};

export const howItWorksSection = {
  eyebrow: "Como funciona",
  title: "O processo é curto",
  subtitle: "Cinco passos. Em torno de 5 minutos até o relatório.",
  steps: [
    {
      step: 1,
      title: `Você paga ${PRICE_DISPLAY_TEXT}`,
      description:
        "Pagamento via Mercado Pago — Pix ou cartão em até 12x. Cobrança única, sem mensalidade.",
    },
    {
      step: 2,
      title: "Conecta a conta de Meta Ads",
      description:
        "Leva 30 segundos. Acesso de leitura apenas:",
      bullets: [
        "Conseguimos VER os dados",
        "NÃO conseguimos editar nada",
        "NÃO conseguimos pausar/ativar",
        "NÃO conseguimos mexer em budget",
      ],
      descriptionAfterBullets:
        "Revogue o acesso quando quiser pelo Meta Business Manager.",
    },
    {
      step: 3,
      title: "IA + expertise analisam tudo",
      description:
        "Campanhas ativas e pausadas, métricas, criativos, públicos e benchmarks do seu nicho. Em torno de 5 a 15 minutos.",
    },
    {
      step: 4,
      title: "Você recebe o link do diagnóstico",
      description:
        "Página exclusiva com os 9 módulos, gráficos e plano priorizado. Fica disponível para consultar sempre que quiser.",
    },
    {
      step: 5,
      title: "Você decide o que fazer",
      description: "Com o relatório em mãos, três caminhos:",
      bullets: [
        "Implementa sozinho (está tudo explicado passo a passo)",
        "Passa para um freelancer ou agência seguirem",
        "Me contrata para a gestão, se o investimento for compatível — sem pressão",
      ],
      descriptionAfterBullets:
        "Sem obrigação. A decisão é 100% sua.",
    },
  ] satisfies HowItWorksStep[],
  summaryCalloutTitle: "Em resumo",
  summaryCalloutBody:
    "Pagou → conectou → aguardou → leu o relatório → decidiu. Simples, rápido, direto.",
  roadmapTitle: "Plano de execução que você recebe",
  roadmapSubtitle:
    "Além do diagnóstico, o relatório entrega uma sequência priorizada: o que fazer primeiro, o que vem depois e quando começar a escalar.",
  roadmapPhases: reportPreviewDemo.roadmapPhases,
};

export const authorSection = {
  title: "Quem está por trás dessa análise",
  name: "DOUGLAS SANTOS",
  role: "Especialista em Meta Ads e Google Ads para e-commerce",
  credentials: [
    "5 anos de experiência em tráfego pago",
    "Ex-Ogilvy (uma das maiores agências do mundo)",
    "Atendimento direto a contas como IBM",
    "Mais de R$ 30 milhões gerenciados em Meta e Google Ads",
    "Atuação na América Latina e América do Norte",
    "Especialista em e-commerces de alto investimento",
  ],
  paragraphs: [
    "Gestor de tráfego profissional, com passagem por Ogilvy, atendimento a contas como IBM e mais de R$ 30 milhões gerenciados em Meta e Google Ads nos últimos 5 anos.",
    "Hoje atendo e-commerces que investem pesado em tráfego pago.",
    "Toda essa bagagem entra na análise da sua conta — técnica, cirúrgica e baseada em dados e benchmarks.",
  ],
};

export type SocialProofCase = {
  metrics: string[];
  niche: string;
  detail: string;
  quote: string;
  author: string;
};

export const socialProofSection = {
  title: "Resultados reais de quem otimizou com base no diagnóstico",
  cases: [
    {
      metrics: [
        "ROAS: 2.1x → 8.3x em 60 dias",
        "CPM: R$ 67 → R$ 28",
        "Investimento: R$ 12.000/mês",
      ],
      niche: "E-COMMERCE DE MODA FEMININA",
      detail: "Ticket médio: R$ 280",
      quote:
        "Eu achava que o problema eram os criativos. O diagnóstico mostrou que a estrutura de campanhas estava completamente errada. Em 2 meses, saímos do vermelho para 5 dígitos de lucro.",
      author: "Marina L., CEO",
    },
    {
      metrics: [
        "Economia de 47% no CPM mantendo volume",
        "CPA: R$ 142 → R$ 68",
        "CTR: 0.9% → 2.7%",
      ],
      niche: "E-COMMERCE DE ELETRÔNICOS",
      detail: "Investimento: R$ 18.000/mês",
      quote:
        "A conta estava 'ok', mas o diagnóstico revelou públicos saturados que eu nem imaginava. Só de cortar isso, economizamos R$ 8.400/mês.",
      author: "Rafael M., Head de Marketing",
    },
    {
      metrics: [
        "De PREJUÍZO para LUCRO em 45 dias",
        "ROAS: 1.2x → 6.8x",
        "Faturamento: +340% no mesmo budget",
      ],
      niche: "E-COMMERCE DE CASA E DECORAÇÃO",
      detail: "Investimento: R$ 25.000/mês",
      quote:
        "Queimávamos R$ 4.200/dia sem resultado. Depois das mudanças recomendadas: R$ 890 de lucro/dia.",
      author: "Camila R., Sócia-fundadora",
    },
  ] satisfies SocialProofCase[],
};

export const guaranteeSection = {
  title: "Garantia incondicional",
  intro:
    `Se eu não encontrar pelo menos 3 problemas graves na sua conta que estejam custando dinheiro, devolvo seus ${PRICE_LABEL} na hora (de ${PRICE_ANCHOR_LABEL} por ${PRICE_LABEL}).`,
  bullets: ["Sem perguntas.", "Sem burocracia.", "Sem enrolação."],
  why: "Toda conta que analiso tem problemas — algumas 5, outras 15. Mas sempre tem.",
  spoiler:
    "Se a sua for a exceção, o dinheiro volta para você.",
  closing: "Risco zero do seu lado.",
};

export type FaqItem = { question: string; answer: string };

export const faqItems: FaqItem[] = [
  {
    question: "Quanto tempo leva para receber?",
    answer:
      "Em torno de 5 minutos depois que você conecta a conta. O processamento é automático: a IA analisa os dados e o relatório fica disponível no seu link exclusivo.",
  },
  {
    question: "Vocês vão ter acesso à minha conta?",
    answer:
      "Apenas leitura. Não conseguimos editar campanhas, pausar/ativar anúncios, mexer em budget ou alterar configurações — só ver os dados. Você revoga o acesso quando quiser pelo Meta Business Manager.",
  },
  {
    question: "Vou ser obrigado a contratar algo depois?",
    answer:
      "Não. Você recebe o diagnóstico com o plano de ação e decide: implementa sozinho, passa para um freelancer ou para o time interno, ou me contrata. Para contas a partir de R$ 5.000/mês em Meta, pode aparecer uma proposta de gestão no relatório — sem obrigação.",
  },
  {
    question: "Por que tão barato? Qual a pegadinha?",
    answer:
      "Sem pegadinha. De R$ 199,90 por R$ 37 é preço estratégico para demonstrar valor e qualificar leads sérios — boa parte do processo é automatizada com IA. Se o volume da conta for compatível, pode surgir convite para gestão, sempre sem obrigação.",
  },
  {
    question: "E se eu não gostar?",
    answer:
      "Devolvo os R$ 37 sem perguntas (preço promocional de R$ 199,90 por R$ 37). Basta avisar em até 7 dias.",
  },
];

export const finalCta = {
  title: "Você já tem os números. Falta ver o que eles dizem.",
  subtitle: "Em ~5 minutos, com risco zero.",
  paragraphs: [
    "Se você chegou até aqui, é porque desconfia que alguma coisa não está fechando nas campanhas — ROAS que não sobe, CPM que não para, faturamento que não acompanha o investimento.",
    `Por ${PRICE_DISPLAY_TEXT} você descobre onde está o problema, quanto está desperdiçando e o que fazer para corrigir.`,
  ],
  stepsIntro: "O que você precisa fazer:",
  steps: [
    "Clicar no botão",
    `Pagar ${PRICE_DISPLAY_TEXT}`,
    "Conectar sua conta",
    "Aguardar alguns minutos",
  ],
  outcomesIntro: "O que você sai sabendo:",
  outcomes: [
    "Onde exatamente está o problema",
    "Quanto está desperdiçando",
    "O que fazer para corrigir",
    "Quanto a loja pode melhorar em 30 dias",
  ],
  closing:
    "Ou age agora, ou segue mais um mês desperdiçando sem saber onde está o buraco.",
  ctaPrimary: `Analisar minha conta — ${PRICE_DISPLAY_TEXT}`,
  trustLines: [
    "Garantia incondicional de 7 dias",
    "Pagamento seguro · Mercado Pago",
  ],
  whatsappHint: "Ainda com dúvida? Me chama no WhatsApp",
};

export const footerSection = {
  signature: "Douglas Santos",
  tagline:
    "Especialista em Meta e Google Ads para E-commerce | Ex-Ogilvy | +R$ 30 milhões gerenciados",
  copyright: "© 2026 — Todos os direitos reservados",
};

export const seoDefaults = {
  title:
    "Diagnóstico Meta Ads para E-commerce — Onde você está perdendo dinheiro | R$ 37",
  description:
    "Auditoria da sua loja online no Meta Ads em ~5 minutos: produto físico, campanhas de vendas, score, vazamentos e plano de ação. Por R$ 37. Pagamento seguro.",
};

export function diagnosisFaqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function diagnosisWhatsAppUrl(): string | null {
  const raw = import.meta.env.VITE_DIAGNOSIS_WHATSAPP_URL?.trim();
  if (!raw) return null;
  return raw;
}

export function diagnosisContactEmail(): string | null {
  const raw = import.meta.env.VITE_DIAGNOSIS_CONTACT_EMAIL?.trim();
  if (!raw) return null;
  return raw;
}
