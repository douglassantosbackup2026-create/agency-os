import { landingPrimaryCtaLargeClass, landingPrimaryCalloutClass } from "@/lib/landing-ui";
import { finalCta } from "@/content/gestao-trafego";

export function GestaoTrafegoFinalCta({ onCtaClick }: { onCtaClick?: () => void }) {
  return (
    <section className="py-14 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className={landingPrimaryCalloutClass}>
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {finalCta.title}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
              {finalCta.body}
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={onCtaClick}
                className={`${landingPrimaryCtaLargeClass} sm:max-w-sm`}
              >
                {finalCta.cta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
