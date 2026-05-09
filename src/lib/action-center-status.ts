/** Estados da Central de Ações considerados “abertos” para SLA, contagens e dashboards. */

export const ACTION_CENTER_OPEN_STATUSES = [
  "pendente",
  "revisar_depois",
  "adiado",
  "anotacao",
  "enviado_cliente",
] as const;

export type ActionCenterOpenStatus =
  (typeof ACTION_CENTER_OPEN_STATUSES)[number];

export const ACTION_CENTER_OPEN_STATUSES_SET = new Set<string>(
  ACTION_CENTER_OPEN_STATUSES,
);

export function isOpenActionCenterStatus(
  status: string | null | undefined,
): boolean {
  return !!status && ACTION_CENTER_OPEN_STATUSES_SET.has(status);
}
