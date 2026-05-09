/** Copy da landing pública Retentio — cockpit diário de performance. */

export const ANCHOR_BRIEFING = "daily-performance-briefing";
export const ANCHOR_DEMO = "demo";

export const hero = {
  eyebrow:
    "Você abre quantas abas toda manhã antes de entender como estão suas contas?",
  headline: "Pare de caçar dados. Comece a tomar decisões.",
  /** Trecho destacado em cor primária no H1 (deve existir dentro de `headline`). */
  headlineHighlight: "tomar decisões.",
  subheadline:
    "O Retentio é o cockpit diário de quem gerencia múltiplos e-commerces: em 60 segundos você sabe qual cliente olhar primeiro, o que mudou, onde está o problema e o que fazer.",
  bullets: [
    "Qual cliente eu olho primeiro hoje?",
    "O que mudou na performance desde ontem?",
    "Onde está o problema — mídia, site ou conversão?",
    "O que eu faço agora?",
    "O que eu comunico para o cliente?",
  ],
  ctaPrimary: "Ver o cockpit em ação",
  ctaSecondary: "Como funciona",
  microcopy:
    "Para gestores de tráfego e agências que atendem múltiplos e-commerces e precisam decidir rápido.",
};

export const painSection = {
  title: "O problema não é falta de dados. É dado demais espalhado.",
  intro:
    "Se você gerencia vários e-commerces, provavelmente sua rotina começa assim:",
  routineLines: [
    "Você abre Meta Ads.",
    "Depois Google Ads.",
    "Depois GA4.",
    "Depois planilha de budget.",
    "Depois relatório.",
    "Depois WhatsApp.",
    "Depois tenta lembrar o que foi ajustado em cada cliente.",
  ],
  bodyAfterRoutine:
    "E quando finalmente entende o cenário, já perdeu boa parte do tempo que deveria estar usando para otimizar campanhas, revisar criativos, ajustar verba e comunicar o cliente.",
  punchline1: "Isso não é gestão de performance.",
  punchline2: "Isso é retrabalho operacional.",
  symptomIntro: "Você sente isso quando:",
  symptoms: [
    "precisa abrir várias plataformas só para saber qual cliente olhar primeiro;",
    "perde tempo cruzando gasto, saldo, receita e meta manualmente;",
    "percebe queda de performance tarde demais;",
    "esquece ações feitas em contas diferentes;",
    "demora para preparar uma atualização para o cliente;",
    "precisa montar análise no improviso antes de reunião;",
    "sente que está gerenciando tudo “na cabeça”.",
  ],
  insightCallout:
    "Na prática, o gargalo raramente é falta de dashboard — é saber por qual conta começar o dia.",
};

export const pivotSection = {
  title: "Você não precisa de mais uma dashboard. Você precisa de prioridade.",
  intro: "Dashboards mostram dados.\n\nO Retentio mostra onde agir.",
  contrastIntro: "A diferença é simples:",
  dashboardQuestion: "“Quais são os números?”",
  retentioQuestion:
    "“Qual cliente precisa de atenção hoje, por qual motivo e qual ação faz mais sentido agora?”",
  closing:
    "É isso que muda sua rotina.\n\nMenos tempo procurando problema.\nMais tempo tomando decisão.",
};

export const solutionSection = {
  title: "Conheça o Retentio",
  subtitle:
    "O sistema operacional diário para gestores de tráfego que atendem múltiplos e-commerces.",
  body: "O Retentio reúne os dados mais importantes da sua operação em uma única rotina de acompanhamento.\n\nEle cruza mídia paga, GA4, budget, metas, histórico, alertas e anotações para gerar um cockpit diário com prioridades claras.",
  checklistIntro: "Você abre a plataforma e entende rapidamente:",
  checklist: [
    "quais clientes estão saudáveis;",
    "quais clientes precisam de atenção;",
    "quais clientes estão críticos;",
    "onde a performance caiu;",
    "se o problema está na mídia, no site, no budget ou no tracking;",
    "qual ação deve ser tomada;",
    "qual mensagem pode ser enviada ao cliente.",
  ],
};

export const briefingMechanism = {
  name: "Daily Performance Briefing",
  explanation:
    "O Daily Performance Briefing é o mecanismo do Retentio que transforma dados espalhados em uma rotina simples de decisão.\n\nEle analisa suas contas, organiza os sinais importantes e mostra o que realmente precisa da sua atenção.",
  stepsTitle: "Como funciona",
  steps: [
    {
      title: "Centraliza",
      body: "Reúne dados de mídia paga, GA4, budget, metas, planilhas e histórico do cliente.",
    },
    {
      title: "Prioriza",
      body: "Classifica clientes por saúde da conta, risco, performance, verba e tendência.",
    },
    {
      title: "Explica",
      body: "Mostra o motivo por trás de cada alerta ou queda de performance.",
    },
    {
      title: "Sugere",
      body: "Gera ações recomendadas com IA para orientar sua próxima decisão.",
    },
    {
      title: "Organiza",
      body: "Transforma análises em tarefas, anotações e mensagens para cliente.",
    },
  ],
};

export const beforeAfterSection = {
  title: "Antes: caos operacional. Depois: clareza diária.",
  rows: [
    { before: "Abrir várias plataformas", after: "Abrir um cockpit diário" },
    { before: "Cruzar dados manualmente", after: "Ver prioridades prontas" },
    {
      before: "Procurar problema cliente por cliente",
      after: "Ver clientes em risco primeiro",
    },
    {
      before: "Montar análise no improviso",
      after: "Gerar análise com IA",
    },
    {
      before: "Perder histórico de ações",
      after: "Registrar tarefas e anotações",
    },
    {
      before: "Comunicar cliente com atraso",
      after: "Gerar mensagem pronta",
    },
    {
      before: "Depender de planilha",
      after: "Operar com visão centralizada",
    },
  ],
  closing:
    "O objetivo não é substituir seu conhecimento como gestor.\n\nÉ tirar o trabalho manual da frente para você usar seu tempo onde ele realmente gera resultado.",
};

export type FeatureCardSlug =
  | "morning-briefing"
  | "health-score"
  | "alertas"
  | "ga4-midia"
  | "auditor-ia"
  | "central-acoes"
  | "mensagens-cliente";

export const featureCards: Array<{
  slug: FeatureCardSlug;
  title: string;
  body: string;
  bullets?: string[];
}> = [
  {
    slug: "morning-briefing",
    title: "Comece o dia sabendo onde agir.",
    body: "Em vez de abrir conta por conta, veja um resumo diário com os clientes que mais precisam de atenção.",
    bullets: ["Qual cliente eu olho primeiro hoje?"],
  },
  {
    slug: "health-score",
    title: "Veja a saúde de cada cliente em segundos.",
    body: "Cada cliente recebe um score baseado em performance, budget, metas, GA4, alertas e histórico operacional.\n\nNão é só número bonito.\n\nÉ uma forma rápida de identificar contas saudáveis, em atenção ou críticas.",
  },
  {
    slug: "alertas",
    title: "Descubra problemas antes que eles virem cobrança.",
    body: "Receba alertas quando algo sai do padrão:",
    bullets: [
      "queda de performance;",
      "budget acelerado;",
      "saldo baixo;",
      "conversão caindo;",
      "GA4 com problema;",
      "campanha sem resultado;",
      "cliente sem atualização.",
    ],
  },
  {
    slug: "ga4-midia",
    title: "Entenda se o problema está na campanha, no site ou na conversão.",
    body: "Nem toda queda de resultado vem da mídia.\n\nO Retentio cruza dados de anúncios com GA4 para ajudar você a entender se o gargalo está no tráfego, na página, no checkout, na oferta ou no tracking.",
  },
  {
    slug: "auditor-ia",
    title: "Claude analisa suas campanhas e sugere onde mexer.",
    body: "A IA avalia campanhas da conta e sugere o que pode ser escalado, mantido, reduzido, pausado, investigado ou corrigido no tracking.\n\nSempre como sugestão.\nNada é alterado automaticamente.\n\nVocê decide.",
  },
  {
    slug: "central-acoes",
    title: "Transforme análise em execução.",
    body: "Toda sugestão pode virar tarefa.\n\nAssim, o insight não morre no relatório e você mantém histórico do que foi feito em cada cliente.",
  },
  {
    slug: "mensagens-cliente",
    title: "Explique performance sem perder tempo escrevendo do zero.",
    body: "Gere mensagens claras para atualizar o cliente sobre resultados, ajustes, quedas, próximos passos e oportunidades.\n\nMenos improviso.\nMais comunicação proativa.",
  },
];

export const authoritySection = {
  title: "Criado por quem vive a rotina real de tráfego.",
  body: "O Retentio não nasceu de uma ideia genérica de SaaS.\n\nEle foi criado a partir de uma dor real: gerenciar vários grandes e-commerces e perder tempo demais abrindo plataformas, planilhas e relatórios para acompanhar performance.",
  bulletsIntro:
    "A plataforma foi pensada para quem precisa operar no dia a dia:",
  bullets: [
    "acompanhar múltiplas contas;",
    "entender performance rapidamente;",
    "priorizar ações;",
    "reduzir retrabalho;",
    "comunicar clientes;",
    "melhorar decisões.",
  ],
  quote:
    "Não é uma ferramenta feita para impressionar em apresentação.\n\nÉ uma ferramenta feita para abrir de manhã e usar.",
};

export const objectionsSection = {
  title: "Objeções comuns",
  betweenCallout:
    "O Retentio não substitui Meta, Google ou GA4 — ordena a sua atenção em cima deles.",
  items: [
    {
      q: "Eu já uso Looker Studio.",
      a: "Ótimo. O Retentio não existe para substituir todos os seus dashboards.\n\nEle existe para responder o que dashboards normalmente não respondem rápido:\n\n“Onde eu preciso agir hoje?”\n\nLooker mostra dados.\nRetentio organiza prioridade, alerta, análise e ação.",
    },
    {
      q: "Eu já tenho planilha.",
      a: "Planilha ajuda a controlar.\n\nMas planilha não te avisa quando uma conta entrou em risco.\nNão cruza mídia com GA4 automaticamente.\nNão gera mensagem para cliente.\nNão transforma alerta em tarefa.\nNão prioriza sua rotina diária.",
    },
    {
      q: "Eu posso abrir Meta Ads e Google Ads direto.",
      a: "Pode.\n\nMas fazer isso para 7, 10 ou 20 clientes todos os dias custa tempo.\n\nO Retentio não impede você de entrar nas plataformas.\nEle te mostra onde vale a pena entrar primeiro.",
    },
    {
      q: "IA pode errar.",
      a: "Sim. Por isso o Retentio não executa alterações automáticas.\n\nA IA sugere.\nVocê revisa.\nVocê decide.\n\nO gestor continua no controle.",
    },
  ],
};

export const costOfInefficiency = {
  title: "Quanto custa não ter clareza?",
  promptQuestion:
    "Você gasta quantas horas por semana montando relatórios e organizando dados de performance?",
  calculation: [
    { label: "3h/semana em análise manual", value: "3h" },
    { label: "× R$150/h (custo do seu tempo)", value: "R$150/h" },
    { label: "× 4 semanas", value: "4 sem." },
    { label: "= custo mensal oculto", value: "R$1.800/mês" },
  ],
  conclusion:
    "O plano Individual do Retentio custa R$497/mês. E ainda libera tempo para você atender mais 4 clientes.",
  punchline: "Não é gasto. É troca de tempo por resultado.",
};

export const pricingSection = {
  title: "Escolha o plano de acordo com o tamanho da sua operação.",
  plans: [
    {
      id: "individual",
      name: "Plano Individual",
      audience: "Para gestores que atendem até 10 clientes",
      price: "R$497/mês",
      includesLead: "Inclui:",
      includes: [
        "até 10 clientes;",
        "Morning Briefing;",
        "Health Score;",
        "alertas internos;",
        "análise IA sob demanda;",
        "GA4;",
        "importação manual/Google Sheets;",
        "Central de Ações;",
        "templates de comunicação.",
      ],
      cta: "Começar com Individual",
      highlighted: false,
    },
    {
      id: "pro",
      name: "Plano Pro",
      audience: "Para gestores e pequenas agências com até 25 clientes",
      price: "R$997/mês",
      badge: "Mais recomendado para operações com vários e-commerces.",
      includesLead: "Inclui tudo do Individual +:",
      includes: [
        "alertas via WhatsApp;",
        "portal do cliente;",
        "relatórios com IA;",
        "Auditor IA de Campanhas;",
        "revisão IA;",
        "múltiplos usuários;",
        "templates avançados;",
        "suporte prioritário.",
      ],
      cta: "Começar com Pro",
      highlighted: true,
      highlightNote: "Melhor custo por conta para carteiras médias.",
    },
    {
      id: "scale",
      name: "Plano Scale",
      audience: "Para agências e operações com 25 a 50 clientes",
      price: "A partir de R$1.997/mês",
      includesLead: "Inclui tudo do Pro +:",
      includes: [
        "white-label;",
        "multiusuário avançado;",
        "painel operacional;",
        "onboarding assistido;",
        "benchmarks;",
        "automações avançadas;",
        "suporte estratégico.",
      ],
      cta: "Falar com especialista",
      highlighted: false,
    },
  ],
};

export const finalCta = {
  title:
    "60 segundos. Você sabe quem precisa de atenção, o que aconteceu e o que fazer.",
  body: "Pare de começar o dia abrindo 10 abas para descobrir o óbvio.\n\nO Retentio coloca seus clientes, alertas, metas, GA4, análises e ações em uma rotina única — para você chegar às decisões, não aos dados.",
  ctaPrimary: "Criar conta gratuita",
  ctaSecondary: "Ver o cockpit em ação",
  microcopy:
    "Explore com dados de demonstração. Sem precisar conectar nada no primeiro dia.",
};

/** Blocos para público frio — confiança, demo e redução de fricção. */
export const coldAudience = {
  trustStripTitle:
    "Pensado para quem opera carteira — reserve este espaço para logos de clientes ou parceiros.",
  /** Placeholders até imagens em `public/`; `initial` para monograma. */
  trustLogos: [
    { name: "Marca A", initial: "A" },
    { name: "Marca B", initial: "B" },
    { name: "Marca C", initial: "C" },
    { name: "Marca D", initial: "D" },
  ],
  notFor:
    "Não é para quem administra uma única loja e resolve tudo só no Ads Manager.",
  forWho:
    "É para gestores e squads que olham vários e-commerces e precisam decidir por onde começar o dia.",
  afterSignupSteps: [
    "Você cria a agência e o workspace em poucos minutos.",
    "Conecta integrações e metas no seu ritmo (OAuth, planilhas e demais canais disponíveis).",
    "Explora o cockpit com dados de exemplo após o cadastro — sem precisar configurar tudo de primeira.",
  ],
  trialOrDemoLine:
    "Ao cadastrar, é possível carregar um cenário de demonstração para sentir o fluxo antes de ligar todas as contas reais.",
  pricingIntro:
    "Escolha pelo tamanho da carteira. Valores por cliente ajudam a comparar quando você cobra por conta.",
  pricingHintIndividual:
    "Individual: até 10 clientes — na tabela cheia, ~R$50/cliente por mês.",
  pricingHintPro:
    "Pro: até 25 clientes — na tabela cheia, ~R$40/cliente por mês; inclui WhatsApp, portal e Auditor IA.",
};

export const testimonialPlaceholder = {
  quote:
    "Eu queria parar de abrir sete abas só para saber quem estava pegando fogo. O cockpit virou meu primeiro lugar da manhã.",
  author: "Gestor de performance",
  role: "Carteira multi e-commerce (uso beta)",
};

/** Hero — screenshot do cockpit de clientes (`<picture>` webp + png). */
export const landingHeroScreenshot = {
  webp: "/landing/hero-cockpit-clientes.webp",
  png: "/landing/hero-cockpit-clientes.png",
  width: 1600,
  height: 980,
  alt: "Interface Retentio: lista de clientes no cockpit operacional com health score, ações abertas, último sync e coluna de auditoria IA.",
} as const;

export type DemoScreenshotPanel = {
  title: string;
  caption: string;
  webp: string;
  png: string;
  width: number;
  height: number;
  alt: string;
};

export const demoSection = {
  title: "Demonstração",
  subtitle:
    "Telas do produto — da carteira ao alerta com próximo passo sugerido. Você também pode incorporar um vídeo pela variável VITE_LANDING_DEMO_URL.",
  panels: [
    {
      title: "Central de alertas",
      caption: "Detecções com contexto e caminho de ação.",
      webp: "/landing/central-alertas.webp",
      png: "/landing/central-alertas.png",
      width: 1400,
      height: 788,
      alt: "Central de alertas do Retentio listando alertas de CPA, criativo fadigado, campanha parada e queda de ROAS por cliente.",
    },
    {
      title: "Cockpit operacional",
      caption: "Carteira numa tabela: health, ações e sync.",
      webp: "/landing/hero-cockpit-clientes.webp",
      png: "/landing/hero-cockpit-clientes.png",
      width: 1600,
      height: 980,
      alt: "Lista de clientes com colunas de health score, ações abertas, último sync e auditoria IA.",
    },
    {
      title: "Health Score",
      caption: "Alto risco, médio e saudáveis em um quadro só.",
      webp: "/landing/health-score.webp",
      png: "/landing/health-score.png",
      width: 1400,
      height: 770,
      alt: "Health Score do Retentio com colunas alto risco, risco médio e clientes saudáveis.",
    },
    {
      title: "Feed operacional",
      caption: "Linha do tempo do que a operação registrou.",
      webp: "/landing/feed-operacional.webp",
      png: "/landing/feed-operacional.png",
      width: 1400,
      height: 780,
      alt: "Feed operacional com eventos como relatório enviado, mudança de budget e calls por cliente.",
    },
    {
      title: "Configuração inicial",
      caption: "Onboarding em passos até o cockpit pronto.",
      webp: "/landing/onboarding-config.webp",
      png: "/landing/onboarding-config.png",
      width: 1400,
      height: 920,
      alt: "Tela de configuração inicial com passos para primeiro cliente, integração e marca.",
    },
    {
      title: "Central de Ações",
      caption: "Da análise à tarefa — filtros por status e cliente.",
      webp: "/landing/central-acoes.webp",
      png: "/landing/central-acoes.png",
      width: 1400,
      height: 760,
      alt: "Central de Ações com filtros de pendência, origem e cliente; estado vazio com opção de limpar filtros.",
    },
    {
      title: "Relatórios IA",
      caption: "Estrutura para gerar e revisar relatórios com IA.",
      webp: "/landing/relatorios-ia.webp",
      png: "/landing/relatorios-ia.png",
      width: 1400,
      height: 780,
      alt: "Relatórios IA do Retentio com painel lateral de período e botão para gerar novo relatório.",
    },
    {
      title: "Inteligência de concorrentes",
      caption: "Watchlist e snapshots para acompanhar o mercado.",
      webp: "/landing/intel-concorrentes.webp",
      png: "/landing/intel-concorrentes.png",
      width: 1400,
      height: 760,
      alt: "Tela de inteligência de concorrentes com watchlist e área de snapshots recentes.",
    },
  ] satisfies DemoScreenshotPanel[],
  briefingLinkLabel: "Como funciona o Daily Performance Briefing",
};

export const miniComparison = {
  title: "BI e planilha vs cockpit",
  subtitle:
    "Resumo para primeira visita. Respostas completas na seção de dúvidas.",
  linkLabel: "Ver todas as objeções",
  rows: [
    {
      label: "Looker / Data Studio",
      them: "Painéis e relatórios que você monta.",
      us: "Ordem do dia: quem olhar primeiro e por quê.",
    },
    {
      label: "Planilha",
      them: "Controle manual e atualização sua.",
      us: "Alertas e cruzamento mídia + GA4 no fluxo.",
    },
    {
      label: "Retentio",
      them: "—",
      us: "Prioridade, histórico operacional e IA como assistente (você decide).",
    },
  ],
};

export const faqConversion: Array<{ question: string; answer: string }> = [
  {
    question: "Preciso pagar antes de ver se serve?",
    answer:
      "Você cria a conta e pode explorar com dados de demonstração para avaliar o fluxo. Planos pagos são escolhidos quando você quiser operar em escala com sua carteira real.",
  },
  {
    question: "Quais integrações existem?",
    answer:
      "O produto evolui continuamente; na prática você conecta canais de mídia, GA4 e fontes de budget conforme disponibilidade no workspace. O onboarding guia o primeiro setup.",
  },
  {
    question: "Meus dados ficam seguros?",
    answer:
      "A operação segue o modelo do seu projeto Supabase e boas práticas de autenticação. Não vendemos dados de clientes.",
  },
  {
    question: "Isso substitui Meta Ads e Google Ads?",
    answer:
      "Não. Você continua otimizando nas plataformas nativas; o Retentio ajuda a priorizar contas e comunicar resultados.",
  },
  {
    question: "IA altera campanhas sozinha?",
    answer:
      "Não. A IA sugere análises e textos; decisões e mudanças nas contas ficam com você.",
  },
  {
    question: "Posso cancelar ou mudar de plano?",
    answer:
      "Comercial e políticas finais dependem do contrato da sua assinatura — use o fluxo de conta ou fale com o time ao escalar para Scale.",
  },
];

/** FAQ estruturado para schema.org (FAQPage). */
export function landingFaqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqConversion.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/** Meta SEO — também espelhado em __root.tsx */
export const seoDefaults = {
  title:
    "Retentio — Cockpit de performance para gestores de tráfego multi e-commerce",
  description:
    "Centralize mídia paga, GA4, budget, metas, alertas e IA em um briefing diário: saiba qual cliente olhar primeiro e onde agir.",
};
