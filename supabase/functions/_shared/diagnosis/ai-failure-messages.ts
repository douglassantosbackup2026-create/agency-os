export type AiAttempt = {
  provider?: string;
  ok?: boolean;
  ms?: number;
  error?: string;
};

export class AiAllProvidersFailedError extends Error {
  readonly attempts: AiAttempt[];
  readonly userMessage: string;
  readonly failureKind: string;

  constructor(attempts: AiAttempt[]) {
    const userMessage = userFacingAiFailure(attempts);
    super(userMessage);
    this.name = "AiAllProvidersFailedError";
    this.attempts = attempts;
    this.userMessage = userMessage;
    this.failureKind = classifyAiFailureKind(attempts);
  }
}

function attemptErrors(attempts: AiAttempt[]): string[] {
  return attempts.map((a) => String(a.error ?? "").toLowerCase());
}

export function classifyAiFailureKind(attempts: AiAttempt[]): string {
  const errors = attemptErrors(attempts);
  if (errors.some((e) => e.includes("insufficient_quota") || e.includes("429"))) {
    return "ai_quota";
  }
  if (errors.some((e) => e.includes("ausente") || e.includes("api_key"))) {
    return "ai_config";
  }
  if (
    attempts.length > 0 &&
    attempts.every((a) => !a.ok && String(a.error ?? "").includes("AbortError"))
  ) {
    return "ai_timeout";
  }
  if (errors.some((e) => e.includes("validation_failed"))) {
    return "ai_validation";
  }
  return "ai_generic";
}

export function userFacingAiFailure(attempts: AiAttempt[]): string {
  const kind = classifyAiFailureKind(attempts);
  switch (kind) {
    case "ai_quota":
      return "Serviço de IA temporariamente indisponível. Estamos a resolver — tenta gerar o relatório novamente em alguns minutos.";
    case "ai_config":
      return "Configuração de IA incompleta. Contacta o suporte com o ID do teu diagnóstico.";
    case "ai_timeout":
      return "A geração do relatório demorou mais do que o esperado. Tenta novamente.";
    case "ai_validation":
      return "Não foi possível validar o relatório gerado. Tenta novamente.";
    default:
      return "Não foi possível gerar o relatório agora. Tenta novamente ou contacta o suporte.";
  }
}

/** Mensagem amigável para erros não-IA já conhecidos ou genéricos. */
export function userFacingDiagnosisError(raw: string): string {
  if (raw.includes("Todos os providers IA falharam:")) {
    const jsonStart = raw.indexOf("[");
    if (jsonStart >= 0) {
      try {
        const attempts = JSON.parse(raw.slice(jsonStart)) as AiAttempt[];
        if (Array.isArray(attempts)) return userFacingAiFailure(attempts);
      } catch {
        /* fall through */
      }
    }
    return userFacingAiFailure([]);
  }
  if (/token meta|reconect/i.test(raw)) return raw.slice(0, 500);
  if (raw.length <= 500 && !raw.startsWith("Error:")) return raw;
  return "Não foi possível concluir o diagnóstico. Tenta novamente ou contacta o suporte.";
}
