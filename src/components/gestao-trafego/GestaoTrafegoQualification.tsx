import { Check, X } from "lucide-react";
import {
  landingEyebrowClass,
  landingSectionScroll,
  landingSurfaceCardClass,
} from "@/lib/landing-ui";
import { qualificationSection } from "@/content/gestao-trafego";

export function GestaoTrafegoQualification() {
  return (
    <section className={`${landingSectionScroll} py-14 sm:py-16`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className={landingEyebrowClass}>{qualificationSection.eyebrow}</span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {qualificationSection.title}
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className={landingSurfaceCardClass}>
            <h3 className="text-base font-semibold">Para quem é</h3>
            <ul className="mt-4 space-y-3">
              {qualificationSection.forYou.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={landingSurfaceCardClass}>
            <h3 className="text-base font-semibold">Não é para quem</h3>
            <ul className="mt-4 space-y-3">
              {qualificationSection.notForYou.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
