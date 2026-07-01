import { Check, ShieldCheck } from "lucide-react";
import {
  landingEyebrowClass,
  landingPrimaryCalloutClass,
  LANDING_SECTION_SCROLL,
  landingSurfaceCardClass,
} from "@/lib/landing-ui";
import { includedSection, guaranteeSection } from "@/content/gestao-trafego";

export function GestaoTrafegoIncluded() {
  return (
    <section className={`${LANDING_SECTION_SCROLL} border-t border-border/60 py-14 sm:py-16`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className={landingEyebrowClass}>{includedSection.eyebrow}</span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {includedSection.title}
          </h2>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          <div className={`${landingSurfaceCardClass} p-6 sm:p-8 lg:col-span-2`}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {includedSection.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`${landingPrimaryCalloutClass} h-full p-6 sm:p-8`}>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h3 className="text-sm font-semibold">{guaranteeSection.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {guaranteeSection.body}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
