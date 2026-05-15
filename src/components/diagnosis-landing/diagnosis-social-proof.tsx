import { Quote } from "lucide-react";
import { ANCHOR_RESULTADOS, socialProofSection } from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingSectionMutedClass,
  landingSurfaceCardClass,
} from "@/lib/landing-ui";

export function DiagnosisSocialProof() {
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
              <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground">
                Screenshot Meta Ads
              </div>
              <ul className="mt-4 space-y-1 text-sm font-semibold">
                {c.metrics.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-primary">
                {c.niche}
              </p>
              <p className="text-xs text-muted-foreground">{c.detail}</p>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                <Quote className="mb-2 h-4 w-4 text-primary" aria-hidden />
                &ldquo;{c.quote}&rdquo;
              </blockquote>
              <p className="mt-3 text-sm font-medium">— {c.author}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
