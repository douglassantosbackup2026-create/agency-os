import { afterEach, describe, expect, it, vi } from "vitest";
import {
  absoluteUrl,
  buildPublicPageHead,
  siteOrigin,
} from "./site-seo";

describe("siteOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to agencyopus.live when env is unset", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    expect(siteOrigin()).toBe("https://agencyopus.live");
  });

  it("trims trailing slash from env", () => {
    vi.stubEnv("VITE_SITE_URL", "https://example.com/");
    expect(siteOrigin()).toBe("https://example.com");
  });
});

describe("absoluteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds root and nested paths", () => {
    vi.stubEnv("VITE_SITE_URL", "https://agencyopus.live");
    expect(absoluteUrl("/")).toBe("https://agencyopus.live/");
    expect(absoluteUrl("/termos")).toBe("https://agencyopus.live/termos");
  });
});

describe("buildPublicPageHead", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes canonical, robots and social tags", () => {
    vi.stubEnv("VITE_SITE_URL", "https://agencyopus.live");
    const head = buildPublicPageHead({
      title: "Test",
      description: "Desc",
      path: "/",
      imagePath: "/og.png",
    });

    expect(head.links?.[0]).toEqual({
      rel: "canonical",
      href: "https://agencyopus.live/",
    });
    expect(head.meta).toEqual(
      expect.arrayContaining([
        { title: "Test" },
        { name: "robots", content: "index,follow" },
        { property: "og:url", content: "https://agencyopus.live/" },
        { property: "og:image", content: "https://agencyopus.live/og.png" },
      ]),
    );
  });
});
