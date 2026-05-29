/** Helpers do funil Diagnóstico Meta (testáveis sem browser). */

export type DiagnosisPollStatus =
  | "awaiting_payment"
  | "awaiting_connection"
  | "processing"
  | "completed"
  | "failed"
  | string;

export function parseObrigadoParams(search: URLSearchParams): {
  diagnosisId: string;
  secretSlug: string;
  autoLoginToken?: string;
} {
  return {
    diagnosisId: (search.get("d") ?? "").trim(),
    secretSlug: (search.get("s") ?? "").trim(),
    autoLoginToken: (search.get("t") ?? "").trim() || undefined,
  };
}

export function obrigadoParamsValid(diagnosisId: string, secretSlug: string): boolean {
  if (!diagnosisId || !secretSlug) return false;
  return /^[0-9a-f-]{36}$/i.test(diagnosisId);
}

/** Estados em que o poll na página /obrigado pode parar de forma terminal. */
export function diagnosisPollTerminal(
  status: string | null | undefined,
): "pending" | "ready" | "failed" {
  if (!status) return "pending";
  if (status === "completed" || status === "failed") return "ready";
  if (status === "awaiting_connection") return "pending";
  return "pending";
}

export function diagnosisStatusAllowsOAuth(status: string | null | undefined): boolean {
  return status === "awaiting_connection";
}

export function managementReferenceIsDiagnosis(externalRef: string): boolean {
  return !externalRef.startsWith("mgmt:");
}

export function managementReferenceId(externalRef: string): string | null {
  if (!externalRef.startsWith("mgmt:")) return null;
  return externalRef.slice(5).trim() || null;
}
