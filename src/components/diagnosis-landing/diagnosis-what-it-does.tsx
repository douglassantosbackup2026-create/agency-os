import { LayoutDashboard } from "lucide-react";
import { ANCHOR_O_QUE_FAZ, whatItDoesSection } from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingEyebrowClass,
  landingSectionMutedClass,
  landingSurfaceCardClass,
} from "@/lib/landing-ui";

export function DiagnosisWhatItDoes() {
  return (
    <section
      id={ANCHOR_O_QUE_FAZ}
      className={`py-16 md:py-24 ${landingSectionMutedClass} ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-0">
        <span className={landingEyebrowClass}>
          <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
          {whatItDoesSection.eyebrow}
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          {whatItDoesSection.title}
        </h2>
        <p className="mt-3 text-muted-foreground">{whatItDoesSection.subtitle}</p>
        <ol className="mt-10 space-y-4">
          {whatItDoesSection.modules.map((mod) => (
            <li
              key={mod.number}
              className={`p-5 md:p-6 ${landingSurfaceCardClass}`}
            >
              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/20">
                  {mod.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {mod.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {mod.description}
                  </p>
                  {mod.example ? (
                    <p className="mt-3 rounded-lg border border-primary/15 bg-primary/[0.04] p-3 text-xs italic text-muted-foreground">
                      {mod.example}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 rounded-lg border border-primary/20 bg-primary/[0.04] p-4 text-sm font-medium leading-relaxed">
          + {whatItDoesSection.bonusNote}
        </p>
      </div>
    </section>
  );
}
