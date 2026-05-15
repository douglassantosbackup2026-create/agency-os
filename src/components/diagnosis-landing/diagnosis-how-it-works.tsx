import { CheckCircle2, Workflow, XCircle } from "lucide-react";
import { ANCHOR_COMO, howItWorksSection } from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingEyebrowClass,
  landingPrimaryCalloutClass,
} from "@/lib/landing-ui";

export function DiagnosisHowItWorks() {
  return (
    <section
      id={ANCHOR_COMO}
      className={`py-16 md:py-20 ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-3xl">
        <span className={landingEyebrowClass}>
          <Workflow className="h-3.5 w-3.5" aria-hidden />
          {howItWorksSection.eyebrow}
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          {howItWorksSection.title}
        </h2>
        <p className="mt-2 text-muted-foreground">{howItWorksSection.subtitle}</p>
        <ol className="relative mt-10 space-y-8 border-l-2 border-primary/20 pl-8">
          {howItWorksSection.steps.map((step) => (
            <li key={step.step} className="relative">
              <span className="absolute -left-[2.35rem] flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-primary-foreground shadow-sm">
                {step.step}
              </span>
              <p className="font-bold text-foreground">{step.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-base">
                {step.description}
              </p>
              {step.bullets ? (
                <ul className="mt-3 space-y-1.5 text-sm">
                  {step.bullets.map((b) => {
                    const positive = b.startsWith("Conseguimos VER");
                    const Icon = positive ? CheckCircle2 : XCircle;
                    const iconClass = positive
                      ? "text-emerald-500"
                      : "text-red-500";
                    return (
                      <li key={b} className="flex gap-2">
                        <Icon
                          className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`}
                          aria-hidden
                        />
                        {b}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {step.descriptionAfterBullets ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {step.descriptionAfterBullets}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        <div className={`mt-8 p-5 md:p-6 ${landingPrimaryCalloutClass}`}>
          <p className="font-bold text-foreground">
            {howItWorksSection.summaryCalloutTitle}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
            {howItWorksSection.summaryCalloutBody}
          </p>
        </div>
      </div>
    </section>
  );
}
