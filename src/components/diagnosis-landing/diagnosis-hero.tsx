import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { hero } from "@/content/diagnosis-landing";
import { DiagnosisCta } from "./diagnosis-cta";

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

export function DiagnosisHero({ onCheckout, loading, error }: Props) {
  return (
    <section id="top" className="pb-10 pt-10 md:pb-14 md:pt-14 lg:pt-16">
      <div className="mx-auto max-w-3xl text-center">
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
        <div className="mx-auto mt-4 max-w-xl space-y-1 text-base leading-relaxed text-muted-foreground">
          {hero.supportingLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <div className="mx-auto mt-8 flex max-w-xs flex-col items-center gap-4 rounded-2xl border border-border/60 bg-muted/30 px-6 py-4 sm:max-w-none sm:flex-row sm:justify-center sm:gap-8 sm:rounded-xl">
          {heroStats.map((stat, i) => (
            <div key={stat.value} className="flex flex-col items-center">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {stat.value}
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                {stat.label}
              </span>
              {i < heroStats.length - 1 && (
                <div className="mt-4 hidden h-8 w-px bg-border/60 sm:block sm:translate-y-[-50%] sm:[position:absolute]" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-8">
          <DiagnosisCta
            size="large"
            label={hero.ctaPrimary}
            sublabel={hero.ctaSub}
            loading={loading}
            onClick={onCheckout}
          />
        </div>
        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}
        <ul className="mx-auto mt-7 flex flex-wrap justify-center gap-2">
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
    </section>
  );
}
