import { describe, expect, it } from "vitest";
import { parseDiagnosisFailedReason } from "./diagnosis-failed-reason";

describe("parseDiagnosisFailedReason", () => {
  it("classifica erro legado de quota OpenAI", () => {
    const raw =
      'Error: Todos os providers IA falharam: [{"provider":"anthropic","ok":false,"ms":60006,"error":"AbortError"},{"provider":"openai","ok":false,"ms":173,"error":"Error: OpenAI HTTP 429: insufficient_quota"}]';
    const parsed = parseDiagnosisFailedReason(raw);
    expect(parsed.kind).toBe("retry");
    expect(parsed.showRetry).toBe(true);
    expect(parsed.telemetryKind).toBe("ai_quota");
    expect(parsed.message).toContain("Serviço de IA temporariamente");
  });

  it("classifica timeout em todos os providers", () => {
    const raw =
      'Error: Todos os providers IA falharam: [{"provider":"anthropic","ok":false,"ms":60006,"error":"AbortError"},{"provider":"openai","ok":false,"ms":60001,"error":"AbortError"}]';
    const parsed = parseDiagnosisFailedReason(raw);
    expect(parsed.telemetryKind).toBe("ai_timeout");
    expect(parsed.showRetry).toBe(true);
  });

  it("detecta falha de token Meta", () => {
    const parsed = parseDiagnosisFailedReason(
      "Token Meta expirado. Reconecta a conta Meta.",
    );
    expect(parsed.kind).toBe("meta_reconnect");
    expect(parsed.showMetaReconnect).toBe(true);
    expect(parsed.showRetry).toBe(false);
  });

  it("aceita mensagem amigável do backend", () => {
    const msg =
      "A geração do relatório demorou mais do que o esperado. Tenta novamente.";
    const parsed = parseDiagnosisFailedReason(msg);
    expect(parsed.message).toBe(msg);
    expect(parsed.showRetry).toBe(true);
  });

  it("não permite retry em orçamento diário", () => {
    const parsed = parseDiagnosisFailedReason(
      "Orçamento diário de IA do diagnóstico atingido. Tente amanhã.",
    );
    expect(parsed.showRetry).toBe(false);
    expect(parsed.telemetryKind).toBe("ai_budget");
  });
});
