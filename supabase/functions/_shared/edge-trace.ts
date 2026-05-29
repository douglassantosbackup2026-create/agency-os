export function traceIdFromRequest(req: Request): string {
  const incoming = req.headers.get("x-request-id")?.trim();
  if (incoming) return incoming.slice(0, 64);
  return crypto.randomUUID();
}

export function traceLog(
  evt: string,
  fields: Record<string, unknown>,
  traceId: string,
): void {
  console.info(
    JSON.stringify({
      evt,
      trace_id: traceId,
      ts: new Date().toISOString(),
      ...fields,
    }),
  );
}
