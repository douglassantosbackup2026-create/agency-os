import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * Extrai mensagem legível do body JSON quando `functions.invoke` falha com HTTP não-2xx
 * (o cliente devolve `FunctionsHttpError` genérico sem analisar o body automaticamente).
 */
export async function edgeFunctionErrorMessage(
  error: unknown,
  fallback = "Erro ao chamar função.",
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response | undefined;
    if (res && typeof res.json === "function") {
      try {
        const ct = res.headers.get("Content-Type") ?? "";
        if (ct.includes("application/json")) {
          const j = (await res.json()) as {
            error?: string;
            message?: string;
          };
          if (typeof j?.error === "string" && j.error.trim()) return j.error;
          if (typeof j?.message === "string" && j.message.trim()) return j.message;
        }
      } catch {
        /* body inválido ou já consumido */
      }
    }
  }
  return error instanceof Error ? error.message : fallback;
}
