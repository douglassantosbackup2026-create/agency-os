/** Classificação de failed_reason do diagnóstico (inclui erros legados com JSON cru). */

export type DiagnosisFailureKind = "meta_reconnect" | "retry" | "support" | "generic";

export type ParsedDiagnosisFailure = {
  message: string;
  kind: DiagnosisFailureKind;
  showRetry: boolean;
  showMetaReconnect: boolean;
  telemetryKind?: string;
};

type AiAttempt = {
  provider?: string;
  ok?: boolean;
  ms?: number;
  error?: string;
};

const META_RECONNECT = /token meta|reconect/i;
const NON_RETRY =
  /Orçamento diário de IA|Configuração de IA incompleta|Contacta o suporte com o ID/i;

function extractAiAttempts(raw: string): AiAttempt[] | null {
  const marker = "Todos os providers IA falharam:";
  const idx = raw.indexOf(marker);
  if (idx < 0) return null;
  const jsonStart = raw.indexOf("[", idx);
  if (jsonStart < 0) return null;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart)) as unknown;
    return Array.isArray(parsed) ? (parsed as AiAttempt[]) : null;
  } catch {
    return null;
  }
}

function classifyFromAttempts(attempts: AiAttempt[]): ParsedDiagnosisFailure {
  const errors = attempts.map((a) => String(a.error ?? "").toLowerCase());

  if (errors.some((e) => e.includes("insufficient_quota") || e.includes("429"))) {
    return {
      message:
        "Serviço de IA temporariamente indisponível. Estamos a resolver — tenta gerar o relatório novamente em alguns minutos.",
      kind: "retry",
      showRetry: true,
      showMetaReconnect: false,
      telemetryKind: "ai_quota",
    };
  }

  if (errors.some((e) => e.includes("ausente") || e.includes("api_key"))) {
    return {
      message:
        "Configuração de IA incompleta. Contacta o suporte com o ID do teu diagnóstico.",
      kind: "support",
      showRetry: false,
      showMetaReconnect: false,
      telemetryKind: "ai_config",
    };
  }

  if (
    attempts.length > 0 &&
    attempts.every((a) => !a.ok && String(a.error ?? "").includes("AbortError"))
  ) {
    return {
      message:
        "A geração do relatório demorou mais do que o esperado. Tenta novamente.",
      kind: "retry",
      showRetry: true,
      showMetaReconnect: false,
      telemetryKind: "ai_timeout",
    };
  }

  if (errors.some((e) => e.includes("validation_failed"))) {
    return {
      message: "Não foi possível validar o relatório gerado. Tenta novamente.",
      kind: "retry",
      showRetry: true,
      showMetaReconnect: false,
      telemetryKind: "ai_validation",
    };
  }

  return {
    message:
      "Não foi possível gerar o relatório agora. Tenta novamente ou contacta o suporte.",
    kind: "retry",
    showRetry: true,
    showMetaReconnect: false,
    telemetryKind: "ai_generic",
  };
}

export function parseDiagnosisFailedReason(
  raw: string | null | undefined,
): ParsedDiagnosisFailure {
  const text = (raw ?? "").trim() || "Erro desconhecido";

  if (META_RECONNECT.test(text)) {
    return {
      message: text,
      kind: "meta_reconnect",
      showRetry: false,
      showMetaReconnect: true,
    };
  }

  if (NON_RETRY.test(text)) {
    return {
      message: text,
      kind: "support",
      showRetry: false,
      showMetaReconnect: false,
      telemetryKind: text.includes("Orçamento") ? "ai_budget" : "ai_config",
    };
  }

  const legacyAttempts = extractAiAttempts(text);
  if (legacyAttempts) {
    return classifyFromAttempts(legacyAttempts);
  }

  if (
    /Serviço de IA temporariamente|Tenta gerar o relatório|Tenta novamente|Não foi possível gerar o relatório|Não foi possível validar|demorou mais do que o esperado/i.test(
      text,
    )
  ) {
    return {
      message: text,
      kind: "retry",
      showRetry: true,
      showMetaReconnect: false,
      telemetryKind: "ai_friendly",
    };
  }

  if (text.startsWith("Error:") || text.length > 200) {
    return {
      message:
        "Não foi possível concluir o diagnóstico. Tenta novamente ou contacta o suporte.",
      kind: "generic",
      showRetry: true,
      showMetaReconnect: false,
      telemetryKind: "unknown",
    };
  }

  return {
    message: text,
    kind: "generic",
    showRetry: false,
    showMetaReconnect: false,
  };
}
