import { memo } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { hero, seniorReportPreview } from "@/content/diagnosis-landing";
import { DiagnosisCta } from "./diagnosis-cta";
import { LandingReportHeroMock } from "./landing-report-mock";

type Props = {
  onCheckout: () => void;
  loading: boolean;
  error: string | null;
};

function HeroHeadline() {
  const full = hero.headline;
  const accent = hero.headlineHighlight;
  if (!accent || !full.includes(accent)) {
    return <>{full}</>;
  }
  const i = full.indexOf(accent);
  return (
    <>
      {full.slice(0, i)}
      <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
        {accent}
      </span>
      {full.slice(i + accent.length)}
    </>
  );
}

const heroStats = [
  { value: "R$30M+", label: "em tráfego gerenciado" },
  { value: "~5 min", label: "para receber o diagnóstico" },
  { value: "7 dias", label: "de garantia total" },
];

function DiagnosisHeroInner({ onCheckout, loading, error }: Props) {
  return (
    <section id="top" className="pb-10 pt-10 md:pb-14 md:pt-14 lg:pt-16">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-12">
        <div className="text-center lg:text-left">
          <span className="inline-flex max-w-xl items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.07] px-3.5 py-1.5 text-xs font-semibold leading-snug tracking-wide text-primary shadow-sm">
            <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {hero.eyebrow}
          </span>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight md:text-5xl lg:text-[3.15rem] lg:leading-[1.12]">
            <HeroHeadline />
          </h1>
          <p className="mt-5 text-balance text-lg font-medium text-foreground md:text-xl">
            {hero.subheadline}
          </p>
          <p className="mt-2 text-balance text-lg font-semibold text-primary md:text-xl">
            {hero.priceLine}
          </p>
          <div className="mx-auto mt-4 max-w-xl space-y-1 text-base leading-relaxed text-muted-foreground lg:mx-0">
            {hero.supportingLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>

          <div className="mx-auto mt-8 flex max-w-xs flex-col items-center gap-4 rounded-2xl border border-border/60 bg-muted/30 px-6 py-4 sm:max-w-none sm:flex-row sm:justify-start sm:gap-8 sm:rounded-xl lg:mx-0">
            {heroStats.map((stat) => (
              <div key={stat.value} className="flex flex-col items-center sm:items-start">
                <span className="text-2xl font-bold tracking-tight text-foreground">
                  {stat.value}
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center lg:justify-start">
            <DiagnosisCta
              size="large"
              label={hero.ctaPrimary}
              loading={loading}
              onClick={onCheckout}
            />
          </div>
          {error ? (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          ) : null}
          <ul className="mx-auto mt-7 flex flex-wrap justify-center gap-2 lg:mx-0 lg:justify-start">
            {hero.trustBadges.map((badge) => (
              <li
                key={badge}
                className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm"
              >
                <CheckCircle2
                  className="h-3.5 w-3.5 shrink-0 text-primary"
                  aria-hidden
                />
                {badge}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-primary/10 blur-2xl"
            aria-hidden
          />
          <LandingReportHeroMock />
          <p className="mt-3 text-center text-xs text-muted-foreground lg:text-left">
            {hero.mockCaption}
          </p>
        </div>
      </div>

      {/* Prova rápida — 3 números do relatório */}
      <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-3 sm:gap-4">
        {[
          {
            label: "Vazamento / mês",
            value: seniorReportPreview.leakMonthlyFormatted,
            tone: "text-red-600 dark:text-red-400",
          },
          {
            label: "Crescimento provável",
            value: seniorReportPreview.growthProbableFormatted,
            tone: "text-blue-600 dark:text-blue-400",
          },
          {
            label: "Maturidade Meta",
            value: `${seniorReportPreview.maturityLevel}/5`,
            tone: "text-amber-600 dark:text-amber-400",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border/60 bg-muted/25 px-3 py-4 text-center sm:px-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
              {item.label}
            </p>
            <p className={`mt-1 text-lg font-bold sm:text-xl ${item.tone}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export const DiagnosisHero = memo(DiagnosisHeroInner);
