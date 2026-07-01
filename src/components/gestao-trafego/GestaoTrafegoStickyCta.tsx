import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { landingPrimaryCtaClass } from "@/lib/landing-ui";
import { hero } from "@/content/gestao-trafego";
import { LEAD_FORM_ID, scrollToLeadForm } from "./GestaoTrafegoHero";

/**
 * Sticky CTA fixo no rodapé em mobile. Fica escondido enquanto o form estiver
 * visível ou o usuário estiver no topo (hero também visível).
 */
export function GestaoTrafegoStickyCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const form = document.getElementById(LEAD_FORM_ID);
    if (!form) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // se o form NÃO estiver visível, mostra a sticky bar
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0.15 },
    );
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-4 py-3 shadow-[0_-6px_20px_-8px_rgba(0,0,0,0.15)] backdrop-blur-md transition-transform duration-200 md:hidden",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      aria-hidden={!visible}
    >
      <button
        type="button"
        onClick={scrollToLeadForm}
        className={cn(landingPrimaryCtaClass, "w-full")}
      >
        {hero.cta}
      </button>
    </div>
  );
}
