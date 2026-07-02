import { useEffect } from "react";
import {
  GestaoTrafegoHeader,
  GestaoTrafegoHero,
  GestaoTrafegoPlatforms,
  GestaoTrafegoClients,
  GestaoTrafegoHowItWorks,
  GestaoTrafegoQualification,
  GestaoTrafegoProblems,
  GestaoTrafegoOperator,
  GestaoTrafegoIncluded,
  GestaoTrafegoSocialProof,
  GestaoTrafegoMoreResultsCta,
  GestaoTrafegoFaq,
  GestaoTrafegoFinalCta,
  GestaoTrafegoStickyCta,
  scrollToLeadForm,
} from "@/components/gestao-trafego";
import { GESTAO_PRODUCT, trackMetaPageView, trackMetaViewContent } from "@/lib/meta-pixel";

export function GestaoTrafegoLandingPage() {
  useEffect(() => {
    trackMetaPageView();
    trackMetaViewContent(GESTAO_PRODUCT, {
      content_name: "Gestão de Tráfego E-commerce Landing",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <GestaoTrafegoHeader onCtaClick={scrollToLeadForm} />
      <main>
        <GestaoTrafegoHero />
        <GestaoTrafegoPlatforms />
        <GestaoTrafegoClients />
        <GestaoTrafegoSocialProof />
        <GestaoTrafegoOperator />
        <GestaoTrafegoProblems />
        <GestaoTrafegoQualification />
        <GestaoTrafegoHowItWorks />
        <GestaoTrafegoIncluded />
        <GestaoTrafegoMoreResultsCta onCtaClick={scrollToLeadForm} />
        <GestaoTrafegoFaq />
        <GestaoTrafegoFinalCta onCtaClick={scrollToLeadForm} />
      </main>
      <GestaoTrafegoStickyCta />
    </div>
  );
}
