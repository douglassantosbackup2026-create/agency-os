/** Classes e constantes partilhadas entre landings públicas (Retentio, Diagnóstico). */

export const LANDING_SECTION_SCROLL =
  "scroll-mt-[calc(4.75rem+env(safe-area-inset-top,0px))]";

export const landingNavAnchorClass =
  "rounded-md px-2.5 py-2 text-xs font-medium text-muted-foreground outline-none ring-offset-background transition hover:bg-muted/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";

export const landingPrimaryCtaClass =
  "glow-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-center text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55";

export const landingPrimaryCtaLargeClass =
  "glow-primary inline-flex min-h-12 w-full flex-col items-center justify-center rounded-lg bg-primary px-6 py-3.5 text-center text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55 sm:px-8 sm:py-4 sm:text-base";

export const landingOutlineCtaClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background/70 px-6 py-2.5 text-center text-sm font-medium backdrop-blur-sm transition hover:border-primary/35 hover:bg-muted/60";

export const landingSurfaceCardClass =
  "surface-card rounded-2xl border border-border shadow-sm ring-1 ring-border/60 transition-shadow hover:shadow-md";

export const landingSectionMutedClass =
  "border-t border-border/60 bg-muted/[0.35] dark:bg-muted/10";

export const landingPrimaryCalloutClass =
  "rounded-2xl border border-primary/20 bg-primary/[0.06] shadow-sm ring-1 ring-primary/10 dark:bg-primary/[0.08]";

export const landingEyebrowClass =
  "inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-primary";
