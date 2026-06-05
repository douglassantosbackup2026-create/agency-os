import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";
import { reportError } from "@/lib/report-error";

const FRIENDLY_BY_CODE: Record<string, string> = {
  too_many_requests: "Muitas tentativas. Aguarde um momento e tente novamente.",
  mp_credentials_environment_mismatch:
    "As credenciais do Mercado Pago estão em modo produção. Para testar, use credenciais TEST- e comprador de teste; para uma venda real, use dados reais do comprador.",
};

export class DiagnosisApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "DiagnosisApiError";
    this.status = status;
    this.code = code;
  }
}

function friendlyMessage(
  status: number,
  body: { error?: string; code?: string } | null,
): string {
  const code = body?.code?.trim();
  if (code && FRIENDLY_BY_CODE[code]) return FRIENDLY_BY_CODE[code];

  const raw = body?.error?.trim();
  if (raw === "too_many_requests") return FRIENDLY_BY_CODE.too_many_requests;
  if (raw && raw.length > 0) return raw;

  if (status === 429) return FRIENDLY_BY_CODE.too_many_requests;
  if (status >= 500) {
    return "Serviço temporariamente indisponível. Tente novamente em instantes.";
  }
  if (status === 404) return "Pedido não encontrado. Verifique o link completo.";
  return "Não foi possível contactar o servidor.";
}

export async function callDiagnosisApi<T>(
  name: string,
  init?: RequestInit & { query?: Record<string, string> },
): Promise<T> {
  let res: Response;
  try {
    res = await invokeDiagnosisFunction(name, init);
  } catch (err) {
    reportError(`diagnosis-api:${name}:network`, err);
    throw new DiagnosisApiError(
      "Falha de rede. Verifique a sua ligação e tente novamente.",
      0,
    );
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const parsed = body as { error?: string; code?: string } | null;
    const err = new DiagnosisApiError(
      friendlyMessage(res.status, parsed),
      res.status,
      parsed?.code,
    );
    if (res.status >= 500) {
      reportError(`diagnosis-api:${name}:${res.status}`, err);
    }
    throw err;
  }

  return body as T;
}
