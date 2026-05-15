import { CheckCircle2, Lock, MessageCircle, Shield, Zap } from "lucide-react";
import { diagnosisWhatsAppUrl, finalCta } from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingPrimaryCalloutClass,
} from "@/lib/landing-ui";
import { DiagnosisCta } from "./diagnosis-cta";

type Props = {
  onCheckout: () => void;
  loading: boolean;
  error: string | null;
};

const trustIcons = [Lock, Zap, MessageCircle, Shield] as const;

export function DiagnosisFinalCta({ onCheckout, loading, error }: Props) {
  const whatsapp = diagnosisWhatsAppUrl();

  return (
    <section
      className={`mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 md:py-28 ${LANDING_SECTION_SCROLL}`}
    >
      <div className={`p-6 md:p-10 ${landingPrimaryCalloutClass}`}>
        <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">
          {finalCta.title}
        </h2>
        <p className="mt-2 text-lg text-muted-foreground">{finalCta.subtitle}</p>
        <div className="mt-6 space-y-3 text-left leading-relaxed text-muted-foreground sm:text-center">
          {finalCta.paragraphs.map((p) => (
            <p key={p.slice(0, 36)}>{p}</p>
          ))}
        </div>
        <p className="mt-6 font-semibold">{finalCta.stepsIntro}</p>
        <ol className="mx-auto mt-3 max-w-sm list-decimal space-y-1 text-left text-sm text-muted-foreground sm:text-center">
          {finalCta.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="mt-6 font-semibold">{finalCta.outcomesIntro}</p>
        <ul className="mx-auto mt-3 max-w-md space-y-2 text-left text-sm sm:inline-block">
          {finalCta.outcomes.map((o) => (
            <li key={o} className="flex gap-2 sm:justify-center">
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-primary"
                aria-hidden
              />
              {o}
            </li>
          ))}
        </ul>
        <p className="mt-6 text-muted-foreground">{finalCta.closing}</p>
        <div className="mt-8">
          <DiagnosisCta
            size="large"
            label={finalCta.ctaPrimary}
            sublabel={finalCta.ctaSub}
            loading={loading}
            onClick={onCheckout}
          />
        </div>
        {error ? (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        ) : null}
        <ul className="mt-6 flex flex-col gap-2 text-xs text-muted-foreground sm:text-sm">
          {finalCta.trustLines.map((line, i) => {
            const Icon = trustIcons[i] ?? CheckCircle2;
            return (
              <li key={line} className="flex items-center justify-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {line}
              </li>
            );
          })}
        </ul>
        {whatsapp ? (
          <p className="mt-6 text-sm">
            {finalCta.whatsappHint}:{" "}
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-90"
            >
              WhatsApp
            </a>
          </p>
        ) : null}
      </div>
    </section>
  );
}
