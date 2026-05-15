import { AlertTriangle, CheckCircle2, Users, XCircle } from "lucide-react";
import { ANCHOR_PARA_QUEM, forWhoSection } from "@/content/diagnosis-landing";
import { LANDING_SECTION_SCROLL, landingEyebrowClass } from "@/lib/landing-ui";

export function DiagnosisQualification() {
  return (
    <section
      id={ANCHOR_PARA_QUEM}
      className={`py-16 md:py-24 ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-5xl">
        <span className={landingEyebrowClass}>
          <Users className="h-3.5 w-3.5" aria-hidden />
          {forWhoSection.eyebrow}
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          {forWhoSection.title}
        </h2>
        <p className="mt-4 text-muted-foreground">{forWhoSection.intro}</p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-6 ring-1 ring-emerald-500/10">
            <p className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
              {forWhoSection.forYouTitle}
            </p>
            <ul className="mt-4 space-y-3">
              {forWhoSection.forYou.map((item) => (
                <li key={item} className="flex gap-3 text-sm md:text-base">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-6 ring-1 ring-red-500/10">
            <p className="flex items-center gap-2 font-bold text-red-700 dark:text-red-400">
              <XCircle className="h-5 w-5 shrink-0" aria-hidden />
              {forWhoSection.notForYouTitle}
            </p>
            <ul className="mt-4 space-y-3">
              {forWhoSection.notForYou.map((item) => (
                <li key={item} className="flex gap-3 text-sm md:text-base">
                  <XCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 md:p-6">
          <p className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
            {forWhoSection.importantCalloutTitle}
          </p>
          <p className="mt-3 text-sm leading-relaxed md:text-base">
            {forWhoSection.importantCalloutBody}
          </p>
        </div>
      </div>
    </section>
  );
}
