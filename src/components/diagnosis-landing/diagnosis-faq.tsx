import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ANCHOR_FAQ, faqItems } from "@/content/diagnosis-landing";
import {
  LANDING_SECTION_SCROLL,
  landingEyebrowClass,
  landingSectionMutedClass,
} from "@/lib/landing-ui";

export function DiagnosisFaq() {
  return (
    <section
      id={ANCHOR_FAQ}
      className={`py-16 md:py-24 ${landingSectionMutedClass} ${LANDING_SECTION_SCROLL}`}
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-0">
        <span className={landingEyebrowClass}>
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
          FAQ
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
          Perguntas frequentes
        </h2>
        <Accordion type="single" collapsible className="mt-8 w-full">
          {faqItems.map((item, i) => (
            <AccordionItem key={item.question} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-sm font-semibold md:text-base">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="leading-relaxed text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
