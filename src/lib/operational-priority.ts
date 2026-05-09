/** Ordem alinhada às queries: prioridade alta primeiro, depois mais recente. */

const ALERT_PRIORITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function alertPriorityRank(p: string | null | undefined): number {
  if (!p) return 0;
  return ALERT_PRIORITY_RANK[p] ?? 0;
}

/** Ordena alertas como no servidor: priority desc, created_at desc. */
export function sortAlertsByOperationalPriority<
  T extends { priority?: string | null; created_at?: string | null },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = alertPriorityRank(a.priority ?? undefined);
    const pb = alertPriorityRank(b.priority ?? undefined);
    if (pb !== pa) return pb - pa;
    const ta = new Date(String(a.created_at ?? 0)).getTime();
    const tb = new Date(String(b.created_at ?? 0)).getTime();
    return tb - ta;
  });
}

const ACTION_PRIORITY_RANK: Record<string, number> = {
  critica: 4,
  alta: 3,
  media: 2,
  baixa: 1,
};

export function actionPriorityRank(p: string | null | undefined): number {
  if (!p) return 0;
  return ACTION_PRIORITY_RANK[p] ?? 0;
}
