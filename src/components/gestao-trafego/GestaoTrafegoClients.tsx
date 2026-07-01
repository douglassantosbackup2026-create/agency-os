import { Store } from "lucide-react";
import {
  landingEyebrowClass,
  LANDING_SECTION_SCROLL,
  landingSurfaceCardClass,
} from "@/lib/landing-ui";
import { anchors, clientsSection } from "@/content/gestao-trafego";

export function GestaoTrafegoClients() {
  return (
    <section
      id={anchors.marcas}
      className={`${LANDING_SECTION_SCROLL} border-t border-border/60 py-14 sm:py-16`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className={landingEyebrowClass}>{clientsSection.eyebrow}</span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {clientsSection.title}
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            {clientsSection.subtitle}
          </p>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clientsSection.items.map((client) => (
            <li
              key={client.name}
              className={`${landingSurfaceCardClass} flex items-center gap-4 p-5 sm:p-6`}
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Store className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-tight">
                  {client.name}
                </p>
                <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {client.niche}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {clientsSection.footnote}
        </p>
      </div>
    </section>
  );
}
