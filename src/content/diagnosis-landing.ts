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
    "Auditoria da sua loja de e-commerce (Meta Ads) em cerca de 5 minutos",
  priceLine: `Por apenas ${PRICE_LABEL}`,
  supportingLines: [
    "Análise técnica + IA de última geração",
    "Feita por quem já gerenciou R$ 30 milhões em tráfego pago",
  ],
  ctaPrimary: "ANALISAR MINHA CONTA AGORA",
  mockCaption:
    "Amostra anonimizada · seu relatório usa os dados da sua loja",
  trustBadges: [
    "Resultado em ~5 minutos",
    "Feito para e-commerce",
    "Pagamento seguro",
  ],
  stickyCtaLabel: `ANALISAR · ${PRICE_LABEL}`,
};

export const reportPreviewSection = {
  eyebrow: "Amostra do Relatório",
  title: "Veja o que o diagnóstico revela sobre sua loja",
  intro:
    "Recorte real do relatório executivo — score, vazamentos em R$, benchmark do nicho e plano priorizado. Abaixo, conta demo anonimizada; o seu usa os dados reais da sua loja de e-commerce no Meta Ads.",
  footerNote:
    "+ módulos de criativos, públicos, oportunidades e projeção 30 dias — tudo interativo na web após conectar a conta de anúncios da sua loja.",
  ctaSublabel: "Relatório completo em ~5 minutos",
};

export const whatIsSection = {
  eyebrow: "O que é",
  title: "O que é o Diagnóstico de Meta Ads para e-commerce?",
  introParagraphs: [
    "É uma auditoria técnica completa da sua conta de Meta Ads (Facebook + Instagram) da sua loja online.",
    'Não é consultoria genérica. Não é checklist básico. Não é "dicas de marketing".',
    "É uma análise CIRÚRGICA dos SEUS dados reais:",
  ],
  dataPoints: [
    "Suas campanhas de vendas/compras dos últimos 90 dias",
    "Seus criativos e performance",
    "Seus públicos e segmentações",
    "Suas métricas comparadas com o mercado",
  ],
  resultsIntro: "Resultado: Você descobre EXATAMENTE:",
  results: [
    "Quais campanhas estão desperdiçando dinheiro",
    "Por que seu ROAS de vendas não sobe",
    "Onde seu CPM está alto demais",
    "Que ajustes fazer para melhorar (com prioridades)",
  ],
  summaryCalloutTitle: "EM RESUMO:",
  summaryCalloutBody:
    'É como fazer um "raio-X" da operação de tráfego da sua loja. Você vai ver cada problema, quanto cada um está custando, e o que fazer para corrigir. Tudo baseado nos SEUS números reais.',
};

export const forWhoSection = {
  eyebrow: "Para quem é",
  title: "Para quem é esse diagnóstico?",
  intro:
    "Esse diagnóstico foi feito especificamente para donos de e-commerce que:",
  forYouTitle: "É PARA VOCÊ SE:",
  forYou: [
    "Você tem um e-commerce ativo vendendo produtos físicos",
    "Investe pelo menos R$ 5.000/mês em Meta Ads",
    "Já tem campanhas rodando ou rodou nos últimos 30 dias",
    "Está frustrado com os resultados atuais: ROAS abaixo de 5-6x, CPM subindo, conversões que não acontecem, ou não sabe onde está o problema",
    "Quer dados concretos (não achismo) sobre o que está errado na conta",
    `Está disposto a investir ${PRICE_LABEL} para descobrir se está perdendo milhares/mês`,
  ],
  notForYouTitle: "NÃO É PARA VOCÊ SE:",
  notForYou: [
    "Você vende infoprodutos, serviços ou afiliados (somos especializados em e-commerce físico)",
    "Investe menos de R$ 5.000/mês (o diagnóstico funciona, mas o ROI é menor)",
    "Nunca rodou Meta Ads ou não tem dados recentes (precisamos de histórico para analisar)",
    "Está 100% satisfeito com os resultados atuais (se tudo está ótimo, não precisa)",
  ],
  importantCalloutTitle: "IMPORTANTE:",
  importantCalloutBody:
    "Se você investe R$ 10.000/mês e descobre que está desperdiçando 30% (R$ 3.000), são R$ 36.000/ano jogados fora. O diagnóstico custa R$ 37. Faz sentido ou não faz?",
};

export type WhatItDoesModule = {
  number: number;
  title: string;
  description: string;
  example?: string;
};

export const whatItDoesSection = {
  eyebrow: "O que faz",
  title: "O que o diagnóstico faz pela sua loja?",
  subtitle: "Você recebe uma análise completa de e-commerce em 9 módulos:",
  modules: [
    {
      number: 1,
      title: "SCORE DE SAÚDE (0-100)",
      description:
        "Avaliação geral da sua conta baseada em 15+ critérios técnicos. Você descobre se sua conta está Crítica (0-30), Necessita Atenção (31-60), Razoável (61-80) ou Excelente (81-100).",
      example:
        'Exemplo: "67/100 - Necessita Atenção. Sua conta tem estrutura razoável mas está perdendo dinheiro com públicos saturados e criativos fracos."',
    },
    {
      number: 2,
      title: "TOP 5 PROBLEMAS CRÍTICOS",
      description:
        "Os maiores problemas que estão matando suas conversões, com impacto quantificado em reais.",
      example:
        "Ex.: Campanha com frequência 8.7 → R$ 2.400/mês desperdiçado; CTR 0.7% vs ideal 2%+; públicos com 73% de sobreposição.",
    },
    {
      number: 3,
      title: "MAPA DE VAZAMENTOS DE BUDGET",
      description:
        "Identificação exata de onde cada real está indo: campanhas que sangram, conjuntos com ROAS abaixo de 2x, onde cortar sem perder resultados.",
      example:
        'Ex.: "Conjunto Público Amplo Brasil gastou R$ 4.200 em 30 dias com ROAS 1.3x. Recomendação: PAUSAR e redirecionar para remarketing."',
    },
    {
      number: 4,
      title: "ANÁLISE DE CRIATIVOS",
      description:
        "O que está funcionando e o que está flopando: melhor e pior criativo (CTR, CPA, por quê) e o que criar/testar agora.",
    },
    {
      number: 5,
      title: "DIAGNÓSTICO DE PÚBLICOS",
      description:
        "Saturação, sobreposição, estrutura de funil (cold/warm/hot), tamanho dos públicos e recomendações específicas de ajuste.",
    },
    {
      number: 6,
      title: "BENCHMARKS DO SEU NICHO",
      description:
        "Comparação dos seus números com o padrão do mercado: ROAS, CPM, CTR e CPA acima/abaixo do ideal.",
      example:
        'Ex.: "Seu ROAS de 2.8x está 53% abaixo do ideal para e-commerce de moda (6.0x)."',
    },
    {
      number: 7,
      title: "OPORTUNIDADES PRIORIZADAS",
      description:
        "Melhorias ordenadas por impacto e facilidade: Quick Wins (hoje), Médio Prazo (1-2 semanas) e Estratégicas (reestruturação), cada uma com ganho estimado.",
    },
    {
      number: 8,
      title: "PLANO DE AÇÃO DETALHADO",
      description:
        "O que fazer primeiro, segundo, terceiro — com descrição, impacto esperado, tempo de implementação e resultado esperado.",
    },
    {
      number: 9,
      title: "ESTIMATIVA DE MELHORIA EM 30 DIAS",
      description:
        "Projeção realista: ROAS atual → potencial, economia mensal em R$, aumento de conversões e nível de confiança.",
      example:
        'Ex.: "Com as otimizações recomendadas, ROAS pode subir de 2.8x para 5.2x em 30-45 dias, gerando R$ 8.400 a mais de lucro/mês."',
    },
  ] satisfies WhatItDoesModule[],
  bonusNote:
    "Bônus: relatório completo e interativo na web — você pode revisar quando quiser e imprimir ou salvar como PDF pelo navegador.",
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
  title: "Como funciona?",
  subtitle: "(Leva 5 minutos para começar)",
  steps: [
    {
      step: 1,
      title: "VOCÊ PAGA R$ 37",
      description:
        "Pagamento 100% seguro via Mercado Pago. Aceita Pix ou cartão em até 12x. Sem pegadinha. Sem mensalidade. Sem renovação.",
    },
    {
      step: 2,
      title: "CONECTA A CONTA DO META ADS DA LOJA",
      description:
        "Leva 30 segundos. Totalmente seguro. Você autoriza acesso de LEITURA:",
      bullets: [
        "Conseguimos VER os dados",
        "NÃO conseguimos editar nada",
        "NÃO conseguimos pausar/ativar",
        "NÃO conseguimos mexer em budget",
      ],
      descriptionAfterBullets:
        "Você pode revogar o acesso quando quiser no Meta Business Manager.",
    },
    {
      step: 3,
      title: "NOSSA IA + EXPERTISE ANALISA TUDO",
      description:
        "Inteligência artificial avançada + revisão humana processam campanhas de vendas ativas e pausadas, métricas dos últimos 90 dias, criativos, públicos e benchmarks do seu nicho de e-commerce. Isso leva de 5 a 15 minutos.",
    },
    {
      step: 4,
      title: "VOCÊ RECEBE O LINK DO DIAGNÓSTICO",
      description:
        "Em cerca de 5 minutos após conectar, você acessa uma página exclusiva com análise interativa, todos os 9 módulos, gráficos e plano de ação priorizado. A página fica disponível para consultar sempre que quiser.",
    },
    {
      step: 5,
      title: "VOCÊ DECIDE O QUE FAZER",
      description: "Com o diagnóstico em mãos, você tem 3 opções:",
      bullets: [
        "Implementa as melhorias SOZINHO (tudo explicado passo a passo)",
        "Contrata um freelancer/agência (e passa o diagnóstico para seguirem)",
        "Me contrata para gestão completa (se o investimento da conta for compatível — proposta sem pressão)",
      ],
      descriptionAfterBullets:
        "Sem compromisso. Sem obrigação. A decisão é 100% sua.",
    },
  ] satisfies HowItWorksStep[],
  summaryCalloutTitle: "EM RESUMO:",
  summaryCalloutBody:
    "Você paga R$ 37 → Conecta sua conta → Aguarda ~5 minutos → Acessa o diagnóstico completo → Decide o que fazer. Simples. Rápido. Direto.",
  roadmapTitle: "Plano de execução que você recebe",
  roadmapSubtitle:
    "Além do diagnóstico, o relatório entrega sequência priorizada — o que fazer primeiro, depois e quando escalar vendas da loja.",
  roadmapPhases: reportPreviewDemo.roadmapPhases,
};

export const authorSection = {
  title: "Quem está por trás dessa análise?",
  name: "DOUGLAS SANTOS",
  role: "Especialista em Meta Ads e Google Ads para E-commerce",
  credentials: [
    "5 anos de experiência em tráfego pago",
    "Ex-Ogilvy (uma das maiores agências do mundo)",
    "Atendimento direto de contas como IBM",
    "Mais de R$ 30 MILHÕES gerenciados em Meta e Google Ads",
    "Atuação na América Latina e América do Norte",
    "Especialista em e-commerces de alto investimento",
  ],
  paragraphs: [
    'Não sou "guru de Instagram" prometendo milagres.',
    "Sou gestor de tráfego PROFISSIONAL com bagagem real: Ogilvy, IBM, R$ 30+ milhões em Meta e Google Ads nos últimos 5 anos.",
    "Hoje atendo e-commerces sérios que investem pesado em tráfego pago.",
    "Vou usar toda essa experiência para analisar sua conta de forma TÉCNICA e CIRÚRGICA.",
    'Não é achismo. Não é "feeling". São dados, benchmarks e anos de prática.',
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
  title: "Garantia Incondicional",
  intro:
    "Se eu não encontrar PELO MENOS 3 PROBLEMAS GRAVES na sua conta que estejam custando dinheiro... eu devolvo seus R$ 37 na hora.",
  bullets: ["Sem perguntas.", "Sem burocracia.", "Sem enrolação."],
  why: "Por quê? Porque TODA conta que analiso tem problemas. Algumas têm 5. Outras têm 15. Mas sempre tem.",
  spoiler:
    "Se a sua for a exceção (spoiler: não vai ser), você recebe seu dinheiro de volta.",
  closing: "É risco ZERO para você.",
};

export type FaqItem = { question: string; answer: string };

export const faqItems: FaqItem[] = [
  {
    question: "Quanto tempo leva para receber?",
    answer:
      "Cerca de 5 minutos após você conectar sua conta. O processamento é automático: a IA analisa os dados e o relatório fica disponível no seu link exclusivo.",
  },
  {
    question: "Vocês vão ter acesso à minha conta?",
    answer:
      "Apenas acesso de LEITURA. NÃO conseguimos editar campanhas, pausar/ativar anúncios, mexer em budget ou alterar configurações. Conseguimos apenas VER os dados. Você revoga o acesso quando quiser no Meta Business Manager.",
  },
  {
    question: "Vou ser obrigado a contratar algo depois?",
    answer:
      "NÃO. Zero pressão. Você recebe o diagnóstico completo com o plano de ação e decide: implementa sozinho, contrata freelancer, passa pro time interno ou me contrata (se quiser). Para contas com investimento compatível (a partir de R$ 5.000/mês em Meta), pode aparecer uma proposta de gestão no relatório — sem obrigação.",
  },
  {
    question: "Por que tão barato? Qual a pegadinha?",
    answer:
      "Não tem pegadinha. R$ 37 é preço estratégico para demonstrar valor, construir confiança e qualificar leads sérios. Automatizei 80% do processo com IA. Se o volume da sua conta for compatível, pode surgir convite para gestão — sempre sem obrigação.",
  },
  {
    question: "E se eu não gostar?",
    answer:
      "Devolvo os R$ 37 sem perguntas. É só avisar em até 7 dias. Simples assim.",
  },
];

export const finalCta = {
  title: "Descubra onde sua loja está perdendo dinheiro",
  subtitle: "(antes de perder ainda mais)",
  paragraphs: [
    "Se você chegou até aqui, é porque você SABE que algo está errado nas suas campanhas.",
    'Talvez seja o ROAS de vendas que não sobe. Talvez seja o CPM que não para de subir. Talvez seja aquela sensação de que o faturamento da loja não acompanha o investimento em anúncios.',
    "Você está certo em desconfiar.",
    `Por ${PRICE_LABEL}, você descobre onde está o problema, quanto está desperdiçando, o que fazer e quanto pode melhorar em 30 dias.`,
    "Em cerca de 5 minutos. Sem risco (garantia total). Sem compromisso (não precisa contratar nada).",
  ],
  stepsIntro: "A única coisa que você precisa fazer:",
  steps: [
    "Clicar no botão",
    "Pagar R$ 37",
    "Conectar sua conta",
    "Aguardar alguns minutos",
  ],
  outcomesIntro: "Você vai descobrir:",
  outcomes: [
    "EXATAMENTE onde está o problema",
    "QUANTO você está desperdiçando",
    "O QUE fazer para corrigir",
    "QUANTO sua loja pode melhorar em 30 dias",
  ],
  closing:
    "Ou você age agora... ou continua no escuro, desperdiçando dinheiro todo mês, sem saber onde está o buraco. A escolha é sua.",
  ctaPrimary: `ANALISAR MINHA CONTA POR ${PRICE_LABEL}`,
  trustLines: [
    "Pagamento 100% seguro (Mercado Pago)",
    "Resultado em ~5 minutos",
    "Suporte via WhatsApp",
    "Garantia incondicional de 7 dias",
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
