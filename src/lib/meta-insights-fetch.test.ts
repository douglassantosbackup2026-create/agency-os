import { describe, expect, it } from "vitest";
import { mergeMetaInsightsPages } from "../../supabase/functions/_shared/meta-insights-fetch.ts";

describe("mergeMetaInsightsPages", () => {
  it("concatena data de múltiplas páginas", () => {
    const pages = [
      { data: [{ date_start: "2026-05-01", spend: "10" }] },
      {
        data: [{ date_start: "2026-05-02", spend: "20" }],
        paging: { next: "https://graph.facebook.com/next" },
      },
    ];
    const merged = mergeMetaInsightsPages(pages);
    expect(merged).toHaveLength(2);
    expect(merged[0].date_start).toBe("2026-05-01");
    expect(merged[1].date_start).toBe("2026-05-02");
  });

  it("retorna vazio sem páginas", () => {
    expect(mergeMetaInsightsPages([])).toEqual([]);
  });
});
