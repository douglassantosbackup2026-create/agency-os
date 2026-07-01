import { Quote } from "lucide-react";
import { GESTAO_TESTIMONIAL } from "@/content/gestao-trafego";
import { landingEyebrowClass } from "@/lib/landing-ui";

export function GestaoTrafegoTestimonial() {
  return (
    <section className="border-t border-border/60 py-14 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center">
          <span className={landingEyebrowClass}>Depoimento</span>
        </div>
        <figure className="mt-8 rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
          <Quote className="h-8 w-8 text-primary/70" aria-hidden />
          <blockquote className="mt-4 text-lg font-medium leading-relaxed sm:text-xl">
            “{GESTAO_TESTIMONIAL.quote}”
          </blockquote>
          <figcaption className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-sm">
            <span className="font-semibold">
              {GESTAO_TESTIMONIAL.author}
              <span className="ml-1 font-normal text-muted-foreground">
                — {GESTAO_TESTIMONIAL.role}
              </span>
            </span>
            <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              {GESTAO_TESTIMONIAL.metric}
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
