import { describe, expect, it } from "vitest";
import { normalizeAiV3Confidence, parseAiV3Json } from "./ai-v3";

describe("ai-v3 utils", () => {
  it("parseia JSON válido", () => {
    const r = parseAiV3Json('{"a":1}');
    expect(r.parseOk).toBe(true);
    expect(r.json.a).toBe(1);
  });

  it("faz fallback para texto bruto", () => {
    const r = parseAiV3Json("texto livre");
    expect(r.parseOk).toBe(false);
    expect(String(r.json.raw_text)).toContain("texto");
  });

  it("normaliza confiança", () => {
    expect(normalizeAiV3Confidence("ALTA")).toBe("alta");
    expect(normalizeAiV3Confidence("baixa")).toBe("baixa");
    expect(normalizeAiV3Confidence("qualquer")).toBe("media");
  });
});
