/** Logs JSON numa linha para Edge Functions (observabilidade). */

export function truncateError(msg: string, max = 400): string {
  const s = String(msg ?? "");
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

export function edgeLog(
  evt: string,
  fields: Record<string, unknown> = {},
): void {
  console.info(JSON.stringify({ evt, ...fields }));
}

export function edgeLogDone(
  evt: string,
  startedAtMs: number,
  fields: Record<string, unknown> = {},
): void {
  edgeLog(evt, {
    ...fields,
    latency_ms: Math.max(0, Date.now() - startedAtMs),
  });
}
