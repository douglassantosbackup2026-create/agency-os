import { createFileRoute } from "@tanstack/react-router";
import { GestaoTrafegoLandingPage } from "@/components/gestao-trafego/GestaoTrafegoLandingPage";
import { seo, seoOgImage } from "@/content/gestao-trafego";
import { buildPublicPageHead } from "@/lib/site-seo";

export type GestaoTrafegoSearch = {
  utm_source?: string;
  utm_campaign?: string;
  utm_adset?: string;
  utm_ad?: string;
};

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): GestaoTrafegoSearch => ({
    utm_source: typeof search.utm_source === "string" ? search.utm_source : undefined,
    utm_campaign:
      typeof search.utm_campaign === "string" ? search.utm_campaign : undefined,
    utm_adset: typeof search.utm_adset === "string" ? search.utm_adset : undefined,
    utm_ad: typeof search.utm_ad === "string" ? search.utm_ad : undefined,
  }),
  head: () =>
    buildPublicPageHead({
      title: seo.title,
      description: seo.description,
      path: "/",
      imagePath: seoOgImage,
    }),
  component: GestaoTrafegoLandingPage,
});
