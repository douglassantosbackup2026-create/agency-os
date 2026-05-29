import { traceIdFromRequest, traceLog } from "./edge-trace.ts";

/** trace_id + log de erro/sucesso para handlers Deno.serve. */
export function beginEdgeTrace(
  req: Request,
  evtPrefix: string,
): { traceId: string; done: (fields?: Record<string, unknown>) => void; fail: (err: unknown) => void } {
  const traceId = traceIdFromRequest(req);
  return {
    traceId,
    done: (fields = {}) => traceLog(`${evtPrefix}.ok`, fields, traceId),
    fail: (err) =>
      traceLog(
        `${evtPrefix}.error`,
        { error: String((err as Error)?.message ?? err) },
        traceId,
      ),
  };
}
