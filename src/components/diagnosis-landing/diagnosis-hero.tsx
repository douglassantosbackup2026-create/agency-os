import { CheckCircle2, Sparkles } from "lucide-react";
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
      <span className="text-primary">{accent}</span>
      {full.slice(i + accent.length)}
    </>
  );
}

export function DiagnosisHero({ onCheckout, loading, error }: Props) {
  return (
    <section
      id="top"
      className="pb-10 pt-10 md:pb-14 md:pt-14 lg:pt-16"
    >
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex max-w-xl items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs leading-snug text-muted-foreground shadow-sm backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
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
        <div className="mt-9">
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
        <ul className="mx-auto mt-8 flex max-w-md flex-col gap-2 text-left text-sm leading-snug text-muted-foreground sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6">
          {hero.trustBadges.map((badge) => (
            <li key={badge} className="flex items-center gap-2 sm:justify-center">
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-primary"
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
