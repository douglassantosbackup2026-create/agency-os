import { memo } from "react";
import { CheckCircle2, Lock, MessageCircle, Shield, Zap } from "lucide-react";
import { diagnosisWhatsAppUrl, finalCta } from "@/content/diagnosis-landing";
import { LANDING_SECTION_SCROLL } from "@/lib/landing-ui";
import { DiagnosisCta } from "./diagnosis-cta";
import { PriceDisplay } from "./price-display";

type Props = {
  onCheckout: () => void;
  loading: boolean;
  error: string | null;
};

const trustIcons = [Lock, Zap, MessageCircle, Shield] as const;

function DiagnosisFinalCtaInner({ onCheckout, loading, error }: Props) {
  const whatsapp = diagnosisWhatsAppUrl();

  return (
    <section
      className={`mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 md:py-28 ${LANDING_SECTION_SCROLL}`}
    >
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 shadow-xl ring-1 ring-white/10 md:p-10">
        <div className="mb-5 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-white/80">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            Hora de agir
          </span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-white md:text-4xl">
          {finalCta.title}
        </h2>
        <p className="mt-2 text-lg text-white/70">{finalCta.subtitle}</p>
        <div className="mt-6 space-y-3 text-left leading-relaxed text-white/70 sm:text-center">
          {finalCta.paragraphs.map((p) => (
            <p key={p.slice(0, 36)}>{p}</p>
          ))}
        </div>
        <p className="mt-6 font-semibold text-white">{finalCta.stepsIntro}</p>
        <ol className="mx-auto mt-3 max-w-sm list-decimal space-y-1 text-left text-sm text-white/70 sm:text-center">
          {finalCta.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="mt-6 font-semibold text-white">
          {finalCta.outcomesIntro}
        </p>
        <ul className="mx-auto mt-3 max-w-md space-y-2 text-left text-sm sm:inline-block">
          {finalCta.outcomes.map((o) => (
            <li key={o} className="flex gap-2 sm:justify-center">
              <CheckCircle2
                className="h-4 w-4 shrink-0 text-emerald-400"
                aria-hidden
              />
              <span className="text-white/80">{o}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-white/70">{finalCta.closing}</p>
        <div className="mt-8">
          <DiagnosisCta
            size="large"
            label={
              <span className="inline-flex items-center justify-center gap-1.5">
                <span>Analisar minha conta —</span>
                <PriceDisplay />
              </span>
            }
            loading={loading}
            onClick={onCheckout}
          />
        </div>
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        <ul className="mt-6 flex flex-col gap-2 text-xs text-white/60 sm:text-sm">
          {finalCta.trustLines.map((line, i) => {
            const Icon = trustIcons[i] ?? CheckCircle2;
            return (
              <li key={line} className="flex items-center justify-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
                {line}
              </li>
            );
          })}
        </ul>
        {whatsapp ? (
          <p className="mt-6 text-sm text-white/70">
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

export const DiagnosisFinalCta = memo(DiagnosisFinalCtaInner);
