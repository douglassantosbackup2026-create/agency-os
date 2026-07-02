import { createFileRoute } from "@tanstack/react-router";
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

import { seo } from "@/content/gestao-trafego";
import { GESTAO_PRODUCT, trackMetaPageView, trackMetaViewContent } from "@/lib/meta-pixel";

const CANONICAL_URL = "https://agencyopus.live/gestao-trafego";

type GestaoTrafegoSearch = {
  utm_source?: string;
  utm_campaign?: string;
  utm_adset?: string;
  utm_ad?: string;
};

export const Route = createFileRoute("/gestao-trafego")({
  validateSearch: (search: Record<string, unknown>): GestaoTrafegoSearch => ({
    utm_source: typeof search.utm_source === "string" ? search.utm_source : undefined,
    utm_campaign: typeof search.utm_campaign === "string" ? search.utm_campaign : undefined,
    utm_adset: typeof search.utm_adset === "string" ? search.utm_adset : undefined,
    utm_ad: typeof search.utm_ad === "string" ? search.utm_ad : undefined,
  }),
  head: () => ({
    meta: [
      { title: seo.title },
      { name: "description", content: seo.description },
      { property: "og:title", content: seo.title },
      { property: "og:description", content: seo.description },
      { property: "og:url", content: CANONICAL_URL },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: CANONICAL_URL }],
  }),
  component: GestaoTrafegoPage,
});

function GestaoTrafegoPage() {
  useEffect(() => {
    trackMetaPageView();
    trackMetaViewContent(GESTAO_PRODUCT, { content_name: "Gestão de Tráfego E-commerce Landing" });
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
