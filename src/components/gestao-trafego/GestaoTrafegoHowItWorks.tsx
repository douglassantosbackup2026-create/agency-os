import { howItWorksSection } from "@/content/gestao-trafego";
import { landingEyebrowClass, landingSectionMutedClass, landingSectionScroll } from "@/lib/landing-ui";

export function GestaoTrafegoHowItWorks() {
  return (
    <section
      id={howItWorksSection.title.toLowerCase().replace(/\s+/g, "-")}
      className={`${landingSectionMutedClass} ${landingSectionScroll} py-14 sm:py-16`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className={landingEyebrowClass}>{howItWorksSection.eyebrow}</span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {howItWorksSection.title}
          </h2>
        </div>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorksSection.steps.map((step) => (
            <li
              key={step.step}
              className="rounded-2xl border border-border bg-background p-5 shadow-sm"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {step.step}
              </div>
              <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
