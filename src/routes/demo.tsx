import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/demo")({
  component: Demo,
});

type ClientStatus = "Crítico" | "Atenção" | "Saudável";

interface DemoClient {
  id: string;
  name: string;
  category: string;
  status: ClientStatus;
  healthScore: number;
  roas: number;
  roasMeta: number;
  roasTrend: "up" | "down" | "stable";
  spend7d: number;
  budgetPct: number;
  alertSummary: string;
  diagnosis: string;
  rootCause: string;
  action: string;
  actionDetail: string;
  clientMessage: string;
}

const DEMO_CLIENTS: DemoClient[] = [
  {
    id: "aurora",
    name: "Aurora Moda",
    category: "Moda Feminina",
    status: "Crítico",
    healthScore: 32,
    roas: 1.8,
    roasMeta: 3.5,
    roasTrend: "down",
    spend7d: 14200,
    budgetPct: 88,
    alertSummary: "ROAS -49% abaixo da meta · CPM subiu 22%",
    diagnosis:
      "O ROAS caiu de 3.4x para 1.8x nos últimos 7 dias. A queda coincide com aumento do CPM no Meta (de R$18 para R$22), sugerindo saturação da audiência do conjunto ativo há 34 dias.",
    rootCause:
      "Criativos do remarketing com frequência média de 6.2 — audiência esgotada. Budget de topo de funil consumiu R$8.400 sem conversão adequada.",
    action: "Pausar conjuntos com frequência > 4. Lançar 3 novos criativos.",
    actionDetail:
      "1. Pausar os 2 conjuntos de remarketing com frequência > 4\n2. Criar novos criativos com ângulo de prova social (reviews)\n3. Reduzir budget de topo de funil em 30% até ROAS estabilizar\n4. Ativar conjunto de lookalike 3% pausado desde a semana passada",
    clientMessage:
      "Oi! Esta semana identificamos que alguns criativos do remarketing estavam com frequência alta, o que impactou o ROAS. Já pausamos esses conjuntos e estamos lançando novos materiais com foco em prova social. Retomada esperada nos próximos 3–5 dias.",
  },
  {
    id: "boreal",
    name: "Boreal Suplementos",
    category: "Saúde & Nutrição",
    status: "Atenção",
    healthScore: 61,
    roas: 3.2,
    roasMeta: 3.0,
    roasTrend: "stable",
    spend7d: 22800,
    budgetPct: 74,
    alertSummary: "Budget 74% consumido — 8 dias restantes no mês",
    diagnosis:
      "O budget mensal está 74% consumido com 27% do mês restante. O ritmo de gasto atual (R$3.257/dia) vai esgotar o budget em 4 dias — 4 dias antes do fim do mês.",
    rootCause:
      "Aumento de lances automáticos na terça (+15% no CPC médio) acelerou o consumo. Campanhas de Performance Max responderam expandindo alcance.",
    action: "Reduzir budget diário em 25% até o fim do mês.",
    actionDetail:
      "1. Reduzir budget diário de R$3.500 para R$2.620 imediatamente\n2. Revisar lances do Performance Max — trocar de Max Conversions para Target ROAS 3.0x\n3. Monitorar gasto diário nos próximos 3 dias\n4. Se ROAS mantiver > 3.0x, avaliar aumento no próximo ciclo",
    clientMessage:
      "Tudo bem! O ROAS está acima da meta (3.2x vs meta 3.0x), ótima notícia. Fizemos um ajuste no ritmo de gasto para garantir que o budget chegue até o final do mês sem interrupção nas campanhas. Nada muda na performance — só estamos distribuindo melhor o investimento.",
  },
  {
    id: "zenith",
    name: "Zenith Pet",
    category: "Pet Shop Online",
    status: "Saudável",
    healthScore: 88,
    roas: 4.8,
    roasMeta: 3.5,
    roasTrend: "up",
    spend7d: 8600,
    budgetPct: 52,
    alertSummary: "ROAS 4.8× — 37% acima da meta · Oportunidade de escala",
    diagnosis:
      "A campanha de coleção inverno está com ROAS 4.8x, 37% acima da meta. O custo por conversão caiu de R$48 para R$31. Budget 52% consumido com 40% do mês restando.",
    rootCause:
      "Novos criativos com UGC (vídeos de clientes reais) lançados na semana passada tiveram CTR 2.3× maior que a média da conta. Público lookalike 3% respondeu muito bem.",
    action: "Escalar budget em 35%. Duplicar conjunto vencedor.",
    actionDetail:
      "1. Aumentar budget da campanha de R$400/dia para R$540/dia (+35%)\n2. Duplicar conjunto lookalike 3% vencedor com novo teto de lances\n3. Criar lookalike 5% usando a mesma base de conversores\n4. Manter criativos UGC — não alterar nada que está funcionando",
    clientMessage:
      "Ótimas notícias esta semana! O ROAS chegou a 4.8x — bem acima da meta de 3.5x. Os novos vídeos com clientes reais estão convertendo muito bem. Aproveitamos para aumentar o investimento nas campanhas que estão performando. Tudo caminha muito bem!",
  },
  {
    id: "delta",
    name: "Delta Casa",
    category: "Casa & Decoração",
    status: "Atenção",
    healthScore: 55,
    roas: 2.4,
    roasMeta: 2.8,
    roasTrend: "down",
    spend7d: 11400,
    budgetPct: 61,
    alertSummary: "GA4: taxa de conversão -31% · Problema no checkout",
    diagnosis:
      "O ROAS caiu de 3.1x para 2.4x mas o CTR e CPC das campanhas estão estáveis. O problema não é a mídia — é o site. Dados do GA4 mostram abandono no checkout subindo de 62% para 81%.",
    rootCause:
      "Deploy realizado na quarta-feira alterou o fluxo de checkout. Taxa de abandono no passo de pagamento subiu de 28% para 67% após o deploy.",
    action: "Urgente: verificar checkout. Problema no site, não nas campanhas.",
    actionDetail:
      "1. URGENTE: Comunicar o cliente sobre problema no checkout\n2. Pedir verificação do deploy da quarta — provável regressão no passo de pagamento\n3. Pausar aumento de budget até checkout ser corrigido\n4. Após correção: monitorar GA4 por 24h para confirmar retorno da taxa",
    clientMessage:
      "Identificamos algo importante: os dados do GA4 mostram que a taxa de abandono no checkout subiu bastante desde quarta-feira. As campanhas estão indo bem (CTR e CPC estáveis), mas parece que algo no site pode ter mudado. Vale verificar se houve alguma atualização no checkout? Assim que corrigirmos, o ROAS deve voltar ao normal rapidamente.",
  },
];

const STATUS_CONFIG: Record<
  ClientStatus,
  { bg: string; text: string; border: string; score: string }
> = {
  Crítico: {
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/30",
    score: "text-rose-600 dark:text-rose-400",
  },
  Atenção: {
    bg: "bg-amber-500/10",
    text: "text-amber-800 dark:text-amber-400",
    border: "border-amber-500/30",
    score: "text-amber-700 dark:text-amber-400",
  },
  Saudável: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-800 dark:text-emerald-400",
    border: "border-emerald-500/30",
    score: "text-emerald-700 dark:text-emerald-400",
  },
};

function HealthBar({ score }: { score: number }) {
  const color =
    score >= 75
      ? "bg-emerald-500"
      : score >= 50
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function TrendIcon({ trend }: { trend: DemoClient["roasTrend"] }) {
  if (trend === "up")
    return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "down")
    return <TrendingUp className="h-3.5 w-3.5 rotate-180 text-rose-500" />;
  return <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function Demo() {
  const [selected, setSelected] = useState<DemoClient | null>(null);
  const [tab, setTab] = useState<"diagnosis" | "action" | "message">(
    "diagnosis",
  );

  function openClient(client: DemoClient) {
    setSelected(client);
    setTab("diagnosis");
  }

  const criticalCount = DEMO_CLIENTS.filter(
    (c) => c.status === "Crítico",
  ).length;
  const attentionCount = DEMO_CLIENTS.filter(
    (c) => c.status === "Atenção",
  ).length;
  const healthyCount = DEMO_CLIENTS.filter(
    (c) => c.status === "Saudável",
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/agency-opus"
            className="flex items-center gap-2 rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              R
            </div>
            <span className="font-semibold tracking-tight text-sm">
              Agency Opus
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary sm:inline-flex">
              Demonstração interativa
            </span>
            <Link
              to="/signup"
              className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-12">
        {/* Intro */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Cockpit de performance
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground md:text-base">
            Esta é uma demonstração com dados fictícios. Clique em qualquer
            cliente para ver o diagnóstico e a ação recomendada pela IA.
          </p>
        </div>

        {/* Resumo carteira */}
        <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/8 px-4 py-3 text-center">
            <p className="text-xl font-semibold text-rose-600 dark:text-rose-400">
              {criticalCount}
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              Crítico
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-center">
            <p className="text-xl font-semibold text-amber-700 dark:text-amber-400">
              {attentionCount}
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              Atenção
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-center">
            <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-400">
              {healthyCount}
            </p>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              Saudável
            </p>
          </div>
        </div>

        {/* Lista de clientes */}
        <div className="space-y-3">
          {DEMO_CLIENTS.map((client) => {
            const cfg = STATUS_CONFIG[client.status];
            return (
              <button
                key={client.id}
                type="button"
                onClick={() => openClient(client)}
                className={`group w-full rounded-xl border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md motion-reduce:hover:translate-y-0 sm:p-5 ${cfg.border}`}
              >
                <div className="flex items-start gap-4">
                  {/* Score */}
                  <div className="flex w-14 shrink-0 flex-col items-center">
                    <span
                      className={`text-2xl font-bold tabular-nums ${cfg.score}`}
                    >
                      {client.healthScore}
                    </span>
                    <HealthBar score={client.healthScore} />
                    <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Score
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {client.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {client.category}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}
                      >
                        {client.status}
                      </span>
                    </div>

                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {client.status === "Crítico" ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                      ) : client.status === "Atenção" ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      )}
                      {client.alertSummary}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                      <span className="flex items-center gap-1">
                        <TrendIcon trend={client.roasTrend} />
                        <span className="text-muted-foreground">ROAS</span>
                        <span className="font-semibold text-foreground">
                          {client.roas}×
                        </span>
                        <span className="text-muted-foreground">
                          / meta {client.roasMeta}×
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Spend 7d:{" "}
                        <span className="font-medium text-foreground">
                          R${client.spend7d.toLocaleString("pt-BR")}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Budget:{" "}
                        <span
                          className={`font-medium ${client.budgetPct >= 80 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}
                        >
                          {client.budgetPct}%
                        </span>
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA banner */}
        <div className="mt-10 rounded-2xl border border-primary/25 bg-primary/[0.06] p-6 text-center md:p-8 dark:bg-primary/[0.1]">
          <Zap className="mx-auto h-6 w-6 text-primary" aria-hidden />
          <h2 className="mt-3 text-lg font-semibold tracking-tight">
            Quer ver assim com suas contas reais?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Conecte Meta Ads, Google Ads e GA4. Em minutos o Agency Opus mostra
            quais clientes precisam de atenção — de verdade.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              Criar conta gratuita
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
            <Link
              to="/agency-opus"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border px-5 text-sm font-medium transition hover:bg-muted/70"
            >
              Saiba mais
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Explore com dados de demonstração. Sem cartão de crédito.
          </p>
        </div>
      </main>

      {/* Dialog de diagnóstico */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle>{selected.name}</DialogTitle>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {selected.category}
                    </p>
                  </div>
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CONFIG[selected.status].bg} ${STATUS_CONFIG[selected.status].text}`}
                  >
                    {selected.status}
                  </span>
                </div>
              </DialogHeader>

              {/* Tabs */}
              <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
                {(
                  [
                    { id: "diagnosis", label: "Diagnóstico" },
                    { id: "action", label: "O que fazer" },
                    { id: "message", label: "Mensagem cliente" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                      tab === t.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "diagnosis" && (
                <div className="space-y-4 text-sm">
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Situação
                    </p>
                    <p className="mt-2 leading-relaxed text-foreground">
                      {selected.diagnosis}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Causa raiz identificada
                    </p>
                    <p className="mt-2 leading-relaxed text-muted-foreground">
                      {selected.rootCause}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("action")}
                    className="flex w-full items-center justify-between rounded-lg border border-primary/25 bg-primary/8 px-4 py-3 text-sm font-medium text-primary transition hover:bg-primary/12"
                  >
                    <span>Ver o que fazer agora</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {tab === "action" && (
                <div className="space-y-4 text-sm">
                  <div className="rounded-xl border border-primary/25 bg-primary/8 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Ação recomendada
                    </p>
                    <p className="mt-2 font-medium text-foreground">
                      {selected.action}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Passo a passo
                    </p>
                    <div className="mt-3 space-y-2">
                      {selected.actionDetail
                        .split("\n")
                        .filter(Boolean)
                        .map((step, idx) => (
                          <div
                            key={idx}
                            className="flex gap-2 text-muted-foreground"
                          >
                            <span className="shrink-0 font-semibold text-primary">
                              {idx + 1}.
                            </span>
                            <span>{step.replace(/^\d+\.\s*/, "")}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("message")}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                  >
                    <span>Ver mensagem para o cliente</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {tab === "message" && (
                <div className="space-y-4 text-sm">
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Mensagem gerada pela IA
                    </p>
                    <p className="mt-3 leading-relaxed text-foreground">
                      {selected.clientMessage}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No Agency Opus real, você edita e envia diretamente pelo
                    WhatsApp ou copia para qualquer canal.
                  </p>
                </div>
              )}

              <div className="border-t border-border pt-4">
                <Link
                  to="/signup"
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  onClick={() => setSelected(null)}
                >
                  Quero ver com meus clientes reais
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
