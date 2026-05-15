import { ANCHOR_O_QUE_FAZ, whatItDoesSection } from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingSectionMutedClass,
} from "@/lib/landing-ui";

export function DiagnosisWhatItDoes() {
  return (
    <section
      id={ANCHOR_O_QUE_FAZ}
      className={`py-16 md:py-24 ${landingSectionMutedClass} ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {whatItDoesSection.eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          {whatItDoesSection.title}
        </h2>
        <p className="mt-3 text-muted-foreground">{whatItDoesSection.subtitle}</p>
        <ol className="mt-10 space-y-10">
          {whatItDoesSection.modules.map((mod) => (
            <li key={mod.number} className="border-b border-border/60 pb-10 last:border-0">
              <p className="text-sm font-semibold text-primary">
                {mod.number}. {mod.title}
              </p>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {mod.description}
              </p>
              {mod.example ? (
                <p className="mt-3 rounded-lg border border-border/80 bg-muted/30 p-3 text-sm italic text-muted-foreground">
                  {mod.example}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-8 rounded-lg border border-primary/20 bg-primary/[0.04] p-4 text-sm font-medium leading-relaxed">
          + {whatItDoesSection.bonusNote}
        </p>
      </div>
    </section>
  );
}
