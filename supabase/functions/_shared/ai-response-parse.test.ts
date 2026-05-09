import { describe, expect, it } from "vitest";
import {
  clampCampaignAuditPeriodDays,
  contentFromGatewayChatCompletion,
  textFromAnthropicMessagesPayload,
} from "./ai-response-parse.ts";
import { parseAiJson } from "./ai-v3.ts";

describe("ai-response-parse (contrato HTTP)", () => {
  it("extrai texto da resposta Anthropic messages", () => {
    const json = {
      content: [{ type: "text", text: '```json\n{"a":1}\n```' }],
    };
    expect(textFromAnthropicMessagesPayload(json)).toContain('"a":1');
  });

  it("extrai content do gateway estilo OpenAI (generate-report)", () => {
    const json = {
      choices: [
        {
          message: {
            content: '{"executive_summary":"ok","confianca_analise":"media"}',
          },
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 2 },
    };
    const raw = contentFromGatewayChatCompletion(json);
    const parsed = parseAiJson(raw);
    expect(parsed.parseOk).toBe(true);
    expect(parsed.json.executive_summary).toBe("ok");
  });

  it("clampCampaignAuditPeriodDays", () => {
    expect(clampCampaignAuditPeriodDays(5)).toBe(7);
    expect(clampCampaignAuditPeriodDays(120)).toBe(90);
    expect(clampCampaignAuditPeriodDays(undefined)).toBe(30);
    expect(clampCampaignAuditPeriodDays("NaN")).toBe(30);
  });
});
