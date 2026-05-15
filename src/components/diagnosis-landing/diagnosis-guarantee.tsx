import { Shield } from "lucide-react";
import { ANCHOR_GARANTIA, guaranteeSection } from "@/content/diagnosis-landing";
import { LANDING_SECTION_SCROLL } from "@/lib/landing-ui";

export function DiagnosisGuarantee() {
  return (
    <section
      id={ANCHOR_GARANTIA}
      className={`py-16 md:py-20 ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-3xl rounded-2xl border-2 border-red-500/30 bg-red-500/5 p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-red-700 dark:text-red-400 md:text-3xl">
          <Shield className="h-7 w-7 shrink-0" aria-hidden />
          {guaranteeSection.title}
        </h2>
        <p className="mt-4 text-lg font-bold leading-relaxed">
          {guaranteeSection.intro}
        </p>
        <ul className="mt-4 space-y-1 font-medium">
          {guaranteeSection.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="mt-6 text-muted-foreground">{guaranteeSection.why}</p>
        <p className="mt-2 italic text-muted-foreground">
          {guaranteeSection.spoiler}
        </p>
        <p className="mt-4 text-lg font-bold">{guaranteeSection.closing}</p>
      </div>
    </section>
  );
}
