/** Limite de payload JSON nas Edge Functions (abuse / erros de cliente). */
export const DEFAULT_MAX_JSON_BYTES = 256 * 1024;

export class BodyTooLargeError extends Error {
  constructor() {
    super("BODY_TOO_LARGE");
    this.name = "BodyTooLargeError";
  }
}

/**
 * Lê o body como JSON até maxBytes. Objeto vazio se body vazio.
 * @throws BodyTooLargeError se exceder o limite
 */
export async function readJsonBody(
  req: Request,
  maxBytes = DEFAULT_MAX_JSON_BYTES,
): Promise<Record<string, unknown>> {
  const cl = req.headers.get("content-length");
  if (cl && /^\d+$/.test(cl) && Number(cl) > maxBytes) {
    throw new BodyTooLargeError();
  }
  const raw = await req.arrayBuffer();
  if (raw.byteLength > maxBytes) throw new BodyTooLargeError();
  const text = new TextDecoder().decode(raw).trim();
  if (!text) return {};
  try {
    const v = JSON.parse(text) as unknown;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}
