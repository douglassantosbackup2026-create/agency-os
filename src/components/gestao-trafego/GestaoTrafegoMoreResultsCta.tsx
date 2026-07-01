import { ArrowRight } from "lucide-react";
import { landingEyebrowClass, landingOutlineCtaClass } from "@/lib/landing-ui";

export function GestaoTrafegoMoreResultsCta({ onCtaClick }: { onCtaClick?: () => void }) {
  return (
    <section className="border-t border-border/60 py-14 sm:py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
        <span className={landingEyebrowClass}>Mais resultados</span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          Quer ver mais cases como esses aplicados na sua operação?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
          Envie os dados da sua loja e o Douglas responde com uma leitura honesta do que dá pra fazer no seu caso — sem repetir promessa de resultado.
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onCtaClick}
            className={landingOutlineCtaClass}
          >
            Falar sobre a minha conta
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
