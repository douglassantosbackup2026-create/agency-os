import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { landingEyebrowClass, LANDING_SECTION_SCROLL } from "@/lib/landing-ui";
import { faqSection, anchors } from "@/content/gestao-trafego";

export function GestaoTrafegoFaq() {
  return (
    <section id={anchors.faq} className={`${LANDING_SECTION_SCROLL} border-t border-border/60 bg-muted/[0.35] py-14 sm:py-16 dark:bg-muted/10`}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <span className={landingEyebrowClass}>{faqSection.eyebrow}</span>
          <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {faqSection.title}
          </h2>
        </div>
        <Accordion type="single" collapsible className="mt-8 space-y-3">
          {faqSection.items.map((item, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="rounded-xl border border-border bg-background px-4"
            >
              <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
