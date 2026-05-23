import { memo } from "react";
import { ArrowRight, CheckCircle2, Lightbulb, Microscope } from "lucide-react";
import { ANCHOR_O_QUE_E, whatIsSection } from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingEyebrowClass,
  landingPrimaryCalloutClass,
} from "@/lib/landing-ui";

function DiagnosisWhatIsInner() {
  return (
    <section
      id={ANCHOR_O_QUE_E}
      className={`py-16 md:py-20 ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-3xl">
        <span className={landingEyebrowClass}>
          <Microscope className="h-3.5 w-3.5" aria-hidden />
          {whatIsSection.eyebrow}
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          {whatIsSection.title}
        </h2>
        <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
          {whatIsSection.introParagraphs.map((p) => (
            <p key={p.slice(0, 40)}>{p}</p>
          ))}
        </div>
        <ul className="mt-4 space-y-2">
          {whatIsSection.dataPoints.map((point) => (
            <li key={point} className="flex gap-2 text-sm md:text-base">
              <ArrowRight
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                aria-hidden
              />
              {point}
            </li>
          ))}
        </ul>
        <p className="mt-8 font-semibold text-foreground">
          {whatIsSection.resultsIntro}
        </p>
        <ul className="mt-3 space-y-2">
          {whatIsSection.results.map((r) => (
            <li key={r} className="flex gap-3 text-sm md:text-base">
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-emerald-500"
                aria-hidden
              />
              {r}
            </li>
          ))}
        </ul>
        <div className={`mt-8 p-5 md:p-6 ${landingPrimaryCalloutClass}`}>
          <p className="flex items-center gap-2 font-bold text-foreground">
            <Lightbulb className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            {whatIsSection.summaryCalloutTitle}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            {whatIsSection.summaryCalloutBody}
          </p>
        </div>
      </div>
    </section>
  );
}

export const DiagnosisWhatIs = memo(DiagnosisWhatIsInner);
