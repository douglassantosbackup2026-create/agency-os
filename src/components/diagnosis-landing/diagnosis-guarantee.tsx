import { memo } from "react";
import { Shield, ShieldCheck } from "lucide-react";
import { ANCHOR_GARANTIA, guaranteeSection } from "@/content/diagnosis-landing";
import { LANDING_SECTION_SCROLL } from "@/lib/landing-ui";

function DiagnosisGuaranteeInner() {
  return (
    <section
      id={ANCHOR_GARANTIA}
      className={`py-16 md:py-20 ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-3xl rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50/80 to-transparent p-6 ring-1 ring-emerald-500/10 dark:from-emerald-500/[0.06] dark:to-transparent md:p-8">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <ShieldCheck className="h-9 w-9" aria-hidden />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-emerald-800 dark:text-emerald-300 md:text-3xl">
              {guaranteeSection.title}
            </h2>
            <p className="mt-4 text-lg font-bold leading-relaxed">
              {guaranteeSection.intro}
            </p>
            <ul className="mt-4 space-y-2 font-medium">
              {guaranteeSection.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <Shield
                    className="h-4 w-4 shrink-0 text-emerald-500"
                    aria-hidden
                  />
                  {b}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-muted-foreground">{guaranteeSection.why}</p>
            <p className="mt-2 italic text-muted-foreground">
              {guaranteeSection.spoiler}
            </p>
            <p className="mt-4 text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {guaranteeSection.closing}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export const DiagnosisGuarantee = memo(DiagnosisGuaranteeInner);
