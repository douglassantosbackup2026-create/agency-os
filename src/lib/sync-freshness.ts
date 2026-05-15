/** Limiares únicos para estado do último sync (horas desde created_at do sync_run). */
export const SYNC_WARNING_HOURS = 24;
export const SYNC_CRITICAL_HOURS = 72;

export type SyncFreshnessLevel =
  | "ok"
  | "warning"
  | "critical"
  | "error"
  | "none";

export function hoursSinceSync(
  isoDate: string | null | undefined,
): number | null {
  if (!isoDate) return null;
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 3600000);
}

export function syncFreshnessFromAgeHours(
  hours: number | null,
  runStatus?: string | null,
): SyncFreshnessLevel {
  if (runStatus === "error") return "error";
  if (hours == null) return "none";
  if (hours >= SYNC_CRITICAL_HOURS) return "critical";
  if (hours >= SYNC_WARNING_HOURS) return "warning";
  return "ok";
}

export function syncFreshnessLevel(
  createdAt: string | undefined,
  runStatus: string | undefined,
): SyncFreshnessLevel {
  if (runStatus === "error") return "error";
  const h = hoursSinceSync(createdAt);
  return syncFreshnessFromAgeHours(h, runStatus);
}

export function formatSyncAgeShort(isoDate: string | null | undefined): string {
  const h = hoursSinceSync(isoDate);
  if (h == null) return "Sem sync";
  if (h < 1) return `há ${Math.round(h * 60)} min`;
  if (h < 48) return `há ${Math.round(h)} h`;
  const d = Math.round(h / 24);
  return `há ${d} d`;
}

export function syncToneClassForFreshness(level: SyncFreshnessLevel): string {
  switch (level) {
    case "error":
      return "text-destructive font-medium";
    case "critical":
      return "text-destructive font-medium";
    case "warning":
      return "text-warning font-medium";
    case "ok":
      return "text-success";
    default:
      return "text-muted-foreground";
  }
}

export function syncLabelForCockpit(
  status: string | undefined,
  createdAt: string | undefined,
): { level: SyncFreshnessLevel; primaryLine: string; toneClass: string } {
  const level = syncFreshnessLevel(createdAt, status);
  const hours = hoursSinceSync(createdAt);
  const primaryLine =
    status === "error"
      ? "Erro no sync"
      : hours != null
        ? formatSyncAgeShort(createdAt)
        : "Sem sync";
  return {
    level,
    primaryLine,
    toneClass: syncToneClassForFreshness(level),
  };
}
