import proof1 from "@/assets/gestao-proof-1.png.asset.json";
import proof2 from "@/assets/gestao-proof-2.png.asset.json";
import proof3 from "@/assets/gestao-proof-3.png.asset.json";
import proofGoogle1 from "@/assets/gestao-proof-google-1.png.asset.json";
import proofGoogle2 from "@/assets/gestao-proof-google-2.png.asset.json";

export const GESTAO_PRODUCT_NAME = "Gestão de Tráfego Pago";
export const GESTAO_PRODUCT_TAGLINE =
  "Execução diária de Meta, Google, TikTok e demais canais — gestão para escalar com ROAS";

export const GESTAO_RESULT_PROOFS: {
  src: string;
  alt: string;
  metric: string;
  caption: string;
  nicho: string;
  platform: "Meta Ads" | "Google Ads";
}[] = [
  {
    src: proof1.url,
    alt: "Print do Gerenciador Meta mostrando R$ 2.720.057,57 em vendas e ROAS 15,59",
    metric: "ROAS 15,59×",
    caption: "R$ 2,72 milhões em vendas em 6 meses",
    nicho: "E-commerce",
    platform: "Meta Ads",
  },
  {
    src: proof2.url,
    alt: "Print do Gerenciador Meta mostrando R$ 4.463.616,78 em vendas e ROAS 32,57",
    metric: "ROAS 32,57×",
    caption: "R$ 4,46 milhões em vendas, operação escalada",
    nicho: "E-commerce",
    platform: "Meta Ads",
  },
  {
    src: proof3.url,
    alt: "Print do Gerenciador Meta com 278 compras, ROAS 10,79 e R$ 383.962,41 em vendas",
    metric: "ROAS 10,79×",
    caption: "278 compras · R$ 383 mil em vendas",
    nicho: "E-commerce",
    platform: "Meta Ads",
  },
  {
    src: proofGoogle1.url,
    alt: "Print do Google Ads mostrando R$ 261.155,62 em valor de conversão e R$ 13.156,46 de custo em 30 dias",
    metric: "ROAS 19,85×",
    caption: "R$ 261 mil em conversões · 163 vendas em 30 dias",
    nicho: "E-commerce",
    platform: "Google Ads",
  },
  {
    src: proofGoogle2.url,
    alt: "Print do Google Ads mostrando R$ 636.534,93 em valor de conversão (incluindo projeções) e R$ 16.028,54 de custo em 30 dias",
    metric: "ROAS 39,71×",
    caption: "R$ 636 mil em conversões · 532 vendas em 30 dias",
    nicho: "E-commerce",
    platform: "Google Ads",
  },
];

export const GESTAO_DELIVERABLES = [
  "Gestão integrada de Meta, Google, TikTok e demais plataformas para escalar a verba",
  "Implementação das correções prioritárias que travam a escala",
  "Gestão diária de campanhas, criativos e públicos em cada canal",
  "Otimização contínua de ROAS, CPA e estrutura de conta para escala",
  "Testes A/B de criativos e ofertas com critério de escala",
  "Relatórios de performance semanais e alinhamento de crescimento",
  "Canal direto com o gestor (WhatsApp) para decisões rápidas",
];

export const GESTAO_GUARANTEE =
  "Sem fidelidade. Cancele quando quiser — basta avisar pelo WhatsApp antes do próximo ciclo mensal.";

export const GESTAO_RECURRENCE_NOTE_PIX =
  "Pix paga a 1ª mensalidade hoje. Nos meses seguintes, enviamos um novo link de Pix pelo WhatsApp 3 dias antes do vencimento — você decide quando confirmar.";

export const GESTAO_RECURRENCE_NOTE_CARD =
  "Cartão ativa a cobrança automática mensal de R$ 4.997 pelo Mercado Pago. A 1ª cobrança acontece agora; as próximas são automáticas todo mês na mesma data. Cancele quando quiser.";

export const GESTAO_PAYMENT_METHOD_HINTS = {
  pix: "Renovação manual",
  card: "Renovação automática",
} as const;

export const GESTAO_CARD_CONSENT =
  "Autorizo o Mercado Pago a cobrar R$ 4.997 mensalmente no meu cartão até eu cancelar.";

export const DEFAULT_MANAGEMENT_PRICE_CENTS = 499700;

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
    "Com passagem por operações de e-commerce de alto ticket · +R$ 30 milhões gerenciados em escala · 5 anos focados em e-commerce",
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
