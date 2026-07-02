import { Check } from "lucide-react";
import {
  landingEyebrowClass,
  LANDING_SECTION_SCROLL,
  landingSurfaceCardClass,
} from "@/lib/landing-ui";
import { operatorSection } from "@/content/gestao-trafego";
import { GESTAO_OPERATOR } from "@/content/gestao-checkout";
import gestaoOperatorAsset from "@/assets/gestao-operator.png.asset.json";

export function GestaoTrafegoOperator() {
  return (
    <section className={`${LANDING_SECTION_SCROLL} border-t border-border/60 py-14 sm:py-16`}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className={`${landingSurfaceCardClass} grid gap-8 p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-center md:gap-12`}>
          <div className="mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-6xl font-bold tracking-tight text-primary md:mx-0">
            {GESTAO_OPERATOR.initials}
          </div>

          <div>
            <span className={landingEyebrowClass}>{operatorSection.eyebrow}</span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              {operatorSection.title}
            </h2>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {GESTAO_OPERATOR.name} · {GESTAO_OPERATOR.role}
            </p>
            <ul className="mt-6 space-y-3">
              {operatorSection.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm sm:text-base">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
