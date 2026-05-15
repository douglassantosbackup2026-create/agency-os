import { AlertTriangle, Eye, TrendingDown, TrendingUp } from "lucide-react";
import { ANCHOR_PREVIEW, PRICE_LABEL } from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingEyebrowClass,
  landingSurfaceCardClass,
} from "@/lib/landing-ui";
import { DiagnosisCta } from "./diagnosis-cta";

type Props = {
  onCheckout: () => void;
  loading: boolean;
};

const demoScore = { value: 67, label: "Necessita Atenção" };

const demoMetrics = [
  {
    name: "ROAS",
    current: "2.8x",
    reference: "6.0x",
    delta: "↓53%",
    bad: true,
  },
  {
    name: "CPM",
    current: "R$67",
    reference: "R$32",
    delta: "↑109%",
    bad: true,
  },
  {
    name: "CTR",
    current: "0.7%",
    reference: "2.0%+",
    delta: "↓65%",
    bad: true,
  },
];

const demoIssues = [
  "Frequência média 8.7 na campanha principal → estimativa de R$2.400/mês desperdiçado",
  "CTR de 0.7% (ideal ≥2%) — criativos com desgaste crítico em 4 conjuntos de anúncios",
  "73% de sobreposição de público entre conjuntos — canibalização de orçamento",
];

const demoBlurred = [
  {
    section: "OPORTUNIDADES PRIORIZADAS",
    items: [
      "Quick Win: Pausar conjunto 'Público Amplo BR' (ROAS 1.3x) → economia de R$4.200/mês",
      "Quick Win: Renovar criativos — testar formato UGC nos top 3 conjuntos",
      "Médio prazo: Reestruturar funil cold/warm/hot com exclusões corretas",
    ],
  },
  {
    section: "PLANO DE AÇÃO — 8 PASSOS",
    items: [
      "1. Pausar imediatamente campanhas com frequência > 5.0",
      "2. Criar novos públicos lookalike a partir dos compradores dos últimos 60 dias",
      "3. Implementar exclusão de compradores em todos os conjuntos de prospecção",
    ],
  },
  {
    section: "PROJEÇÃO 30 DIAS",
    items: [
      "ROAS potencial: 2.8x → 5.2x com as otimizações recomendadas",
      "Economia mensal estimada: R$8.400 em budget desperdiçado",
      "Aumento de conversões: +86% mantendo o mesmo investimento",
    ],
  },
];

export function DiagnosisReportPreview({ onCheckout, loading }: Props) {
  return (
    <section
      id={ANCHOR_PREVIEW}
      className={`py-16 md:py-24 ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-3xl">
        <span className={landingEyebrowClass}>
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Amostra do Relatório
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          Veja o que o diagnóstico revela sobre sua conta
        </h2>
        <p className="mt-3 text-muted-foreground">
          Abaixo, uma amostra real de como o relatório apresenta os dados — com
          uma conta-demo anonimizada. O seu terá os dados da sua própria conta.
        </p>

        <div className={`mt-8 overflow-hidden ${landingSurfaceCardClass}`}>
          {/* Demo badge */}
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Diagnóstico Meta Ads — Conta Demo
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
              Anonimizado
            </span>
          </div>

          <div className="p-5 md:p-6">
            {/* Score */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-50/60 p-4 dark:bg-amber-500/[0.06]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Score de Saúde
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-5xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                      {demoScore.value}
                    </span>
                    <span className="text-lg text-muted-foreground">/100</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {demoScore.label}
                </span>
              </div>
              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-amber-200/60 dark:bg-amber-900/40">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${demoScore.value}%` }}
                />
              </div>
            </div>

            {/* Metrics */}
            <div className="mt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Métricas Comparativas
              </p>
              <div className="grid gap-2">
                {demoMetrics.map((m) => (
                  <div
                    key={m.name}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-4 py-3"
                  >
                    <span className="text-sm font-semibold">{m.name}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-bold text-foreground">
                        {m.current}
                      </span>
                      <span className="text-muted-foreground">
                        vs ref. {m.reference}
                      </span>
                      <span
                        className={`flex items-center gap-1 font-semibold ${
                          m.bad
                            ? "text-red-600 dark:text-red-400"
                            : "text-emerald-600"
                        }`}
                      >
                        {m.bad ? (
                          <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {m.delta}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Issues */}
            <div className="mt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Top 3 Problemas Críticos
              </p>
              <ul className="space-y-2">
                {demoIssues.map((issue) => (
                  <li
                    key={issue}
                    className="flex gap-3 rounded-lg border border-red-500/20 bg-red-50/50 px-4 py-3 dark:bg-red-500/[0.04]"
                  >
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0">
                      <span className="mr-2 inline-block rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-400">
                        Alta
                      </span>
                      <span className="text-sm">{issue}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Blurred section */}
            <div className="relative mt-5 overflow-hidden rounded-xl border border-border/60">
              <div className="pointer-events-none select-none p-4 blur-sm">
                {demoBlurred.map((block) => (
                  <div key={block.section} className="mb-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {block.section}
                    </p>
                    <ul className="space-y-1.5">
                      {block.items.map((item) => (
                        <li
                          key={item}
                          className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-transparent" />
              {/* CTA over blur */}
              <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 pb-6 px-4 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  + 6 módulos completos: criativos, públicos, plano de ação e
                  projeção
                </p>
                <DiagnosisCta
                  size="large"
                  label={`ANALISAR MINHA CONTA — ${PRICE_LABEL}`}
                  sublabel="Relatório completo em ~5 minutos"
                  loading={loading}
                  onClick={onCheckout}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
