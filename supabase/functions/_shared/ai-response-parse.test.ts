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

  it("parse JSON da pauta de reunião (generate-meeting-report)", () => {
    const raw = JSON.stringify({
      agenda: "1) Abrir\n2) Resultados",
      what_worked: "Volume estável.",
      what_to_improve: "CPA alto.",
      next_month_plan: "Testes criativos.",
      strategic_questions: "Prioridade do mês?",
      versao_curta_5_minutos: "Resumo em 5 min.",
      modo_reuniao: "revisao_padrao",
      risco_churn: "baixo",
      tom_recomendado: "consultivo",
      tempo_total_minutos: 28,
      principais_pontos: ["a", "b"],
      perguntas_cliente: ["Pergunta 1?"],
      proximo_passo_recomendado: "Validar orçamento.",
      requer_preparacao_extra: false,
      confianca_analise: "alta",
    });
    const parsed = parseAiJson(raw);
    expect(parsed.parseOk).toBe(true);
    expect(parsed.json.modo_reuniao).toBe("revisao_padrao");
    expect(parsed.json.agenda).toContain("Resultados");
  });

  it("clampCampaignAuditPeriodDays", () => {
    expect(clampCampaignAuditPeriodDays(5)).toBe(7);
    expect(clampCampaignAuditPeriodDays(120)).toBe(90);
    expect(clampCampaignAuditPeriodDays(undefined)).toBe(30);
    expect(clampCampaignAuditPeriodDays("NaN")).toBe(30);
  });
});
