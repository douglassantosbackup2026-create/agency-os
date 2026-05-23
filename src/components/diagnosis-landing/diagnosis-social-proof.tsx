import { memo } from "react";
import { Quote, TrendingUp } from "lucide-react";
import {
  ANCHOR_RESULTADOS,
  socialProofSection,
  type SocialProofCase,
} from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingSectionMutedClass,
  landingSurfaceCardClass,
} from "@/lib/landing-ui";

function MetricsCard({ metrics }: { metrics: SocialProofCase["metrics"] }) {
  return (
    <div className="flex aspect-video flex-col justify-center gap-3 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 px-5 py-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
        <TrendingUp className="h-3.5 w-3.5" aria-hidden />
        Resultados reais
      </div>
      <ul className="space-y-2">
        {metrics.map((m) => (
          <li key={m} className="text-sm font-semibold text-white">
            {m}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiagnosisSocialProofInner() {
  return (
    <section
      id={ANCHOR_RESULTADOS}
      className={`py-16 md:py-24 ${landingSectionMutedClass} ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-0">
        <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
          {socialProofSection.title}
        </h2>
        <div className="mt-10 grid gap-8 md:grid-cols-3">
          {socialProofSection.cases.map((c) => (
            <article
              key={c.author}
              className={`flex flex-col p-5 ${landingSurfaceCardClass}`}
            >
              <MetricsCard metrics={c.metrics} />
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-primary">
                {c.niche}
              </p>
              <p className="text-xs text-muted-foreground">{c.detail}</p>
              <blockquote className="mt-4 flex-1 border-l-2 border-primary/30 pl-3 text-sm leading-relaxed text-muted-foreground">
                <Quote className="mb-1.5 h-4 w-4 text-primary/60" aria-hidden />
                &ldquo;{c.quote}&rdquo;
              </blockquote>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary ring-1 ring-primary/20">
                  {c.author.charAt(0)}
                </div>
                <p className="text-sm font-medium">— {c.author}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export const DiagnosisSocialProof = memo(DiagnosisSocialProofInner);
