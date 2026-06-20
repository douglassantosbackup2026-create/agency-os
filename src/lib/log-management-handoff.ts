import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";

export type ManagementHandoffKind =
  | "whatsapp_click"
  | "report_back_click"
  | "whatsapp_view";

/**
 * Regista um evento de handoff pós-pagamento. Usa `keepalive: true` para
 * sobreviver à navegação que abre o WhatsApp noutra aba. Falha em silêncio:
 * o clique nunca deve ser bloqueado por causa do log.
 */
export function logManagementHandoff(args: {
  diagnosisId: string;
  secretSlug: string;
  kind: ManagementHandoffKind;
  payload?: Record<string, unknown>;
}): void {
  if (!args.diagnosisId || !args.secretSlug) return;
  try {
    void invokeDiagnosisFunction("log-management-handoff", {
      method: "POST",
      keepalive: true,
      body: JSON.stringify({
        diagnosis_id: args.diagnosisId,
        secret_slug: args.secretSlug,
        kind: args.kind,
        payload: args.payload ?? null,
      }),
    }).catch(() => {
      /* ignore — telemetria, nunca bloqueante */
    });
  } catch {
    /* ignore */
  }
}
