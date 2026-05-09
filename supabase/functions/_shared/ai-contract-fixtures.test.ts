import { describe, expect, it } from "vitest";
import { parseAiJson } from "./ai-v3";
import { extractJsonFromModelText } from "./campaign-audit-helpers";

/** Contrato mínimo: resposta tipo gateway com markdown fence (campaign-ai-audit). */
const AUDIT_GATEWAY_SAMPLE = `Segue a análise.

\`\`\`json
{"executive_summary_markdown":"## Resumo","overall_status":"attention","recommendations":[{"campaign_id":"c1","suggestion_type":"investigate"}]}
\`\`\`
`;

describe("contrato fixtures IA (auditoria / relatório)", () => {
  it("campaign-ai-audit: extrai e parseia JSON do modelo", () => {
    const extracted = extractJsonFromModelText(AUDIT_GATEWAY_SAMPLE);
    const parsed = parseAiJson(extracted);
    expect(parsed.parseOk).toBe(true);
    expect(parsed.json.overall_status).toBe("attention");
    expect(Array.isArray(parsed.json.recommendations)).toBe(true);
  });

  it("generate-report: JSON direto sem fences", () => {
    const raw = JSON.stringify({
      executive_summary: "Ok",
      confianca_analise: "media",
    });
    const parsed = parseAiJson(raw);
    expect(parsed.parseOk).toBe(true);
    expect(parsed.json.executive_summary).toBe("Ok");
  });
});
