const DEFAULT_SITE_ORIGIN = "https://agencyopus.live";

export function siteOrigin(): string {
  const raw =
    typeof import.meta.env.VITE_SITE_URL === "string"
      ? import.meta.env.VITE_SITE_URL.trim()
      : "";
  return raw.replace(/\/$/, "") || DEFAULT_SITE_ORIGIN;
}

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return `${siteOrigin()}/`;
  return `${siteOrigin()}${normalized}`;
}

type BuildPublicPageHeadOptions = {
  title: string;
  description: string;
  path: string;
  imagePath?: string;
  robots?: string;
  type?: string;
};

export function buildPublicPageHead({
  title,
  description,
  path,
  imagePath,
  robots = "index,follow",
  type = "website",
}: BuildPublicPageHeadOptions) {
  const canonical = absoluteUrl(path);
  const ogImage = imagePath ? absoluteUrl(imagePath) : undefined;

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: robots },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: canonical },
      { property: "og:type", content: type },
      {
        name: "twitter:card",
        content: ogImage ? "summary_large_image" : "summary",
      },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(ogImage
        ? ([
            { property: "og:image", content: ogImage },
            { name: "twitter:image", content: ogImage },
          ] as const)
        : []),
    ],
    links: [{ rel: "canonical", href: canonical }],
  };
}

export function buildFallbackSiteMeta(
  title: string,
  description: string,
  imagePath?: string,
) {
  const ogImage = imagePath ? absoluteUrl(imagePath) : undefined;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    {
      name: "twitter:card",
      content: ogImage ? "summary_large_image" : "summary",
    },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    ...(ogImage
      ? ([
          { property: "og:image", content: ogImage },
          { name: "twitter:image", content: ogImage },
        ] as const)
      : []),
  ];
}
