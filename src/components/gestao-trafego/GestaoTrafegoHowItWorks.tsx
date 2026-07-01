import { ClipboardList, ScanSearch, FileText, Rocket, type LucideIcon } from "lucide-react";
import { anchors, howItWorksSection } from "@/content/gestao-trafego";
import { landingEyebrowClass, landingSectionMutedClass, LANDING_SECTION_SCROLL } from "@/lib/landing-ui";

const STEP_ICONS: Record<number, LucideIcon> = {
  1: ClipboardList,
  2: ScanSearch,
  3: FileText,
  4: Rocket,
};

export function GestaoTrafegoHowItWorks() {
  return (
    <section
      id={anchors.comoFunciona}
      className={`${landingSectionMutedClass} ${LANDING_SECTION_SCROLL} py-14 sm:py-16`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className={landingEyebrowClass}>{howItWorksSection.eyebrow}</span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {howItWorksSection.title}
          </h2>
        </div>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorksSection.steps.map((step) => {
            const Icon = STEP_ICONS[step.step] ?? ClipboardList;
            return (
              <li
                key={step.step}
                className="relative rounded-2xl border border-border bg-background p-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Passo {step.step}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
