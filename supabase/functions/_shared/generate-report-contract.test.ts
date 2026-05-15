/**
 * Contrato HTTP — generate-report
 *
 * Testa as guards de auth/body que a função executa antes de chamar a IA.
 * Não importa o handler Deno diretamente; simula o padrão de validação
 * usando as mesmas helpers de _shared que a função usa em produção.
 */
import { describe, expect, it } from "vitest";
import { BodyTooLargeError, readJsonBody } from "./edge-json-body";
import { parseAiJson } from "./ai-v3";

// ---------------------------------------------------------------------------
// Guard helpers — mirrors o que generate-report/index.ts faz antes de chamar IA
// ---------------------------------------------------------------------------

function checkAuth(req: Request): Response | null {
  if (!req.headers.get("Authorization")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  return null;
}

async function checkBody(
  req: Request,
): Promise<{ response: Response } | { client_id: string }> {
  let body: Record<string, unknown>;
  try {
    body = (await readJsonBody(req)) as Record<string, unknown>;
  } catch (e) {
    if (e instanceof BodyTooLargeError) {
      return {
        response: new Response(
          JSON.stringify({ error: "payload demasiado grande" }),
          { status: 413 },
        ),
      };
    }
    body = {};
  }
  const client_id = String(body.client_id ?? "").trim();
  if (!client_id) {
    return {
      response: new Response(JSON.stringify({ error: "client_id required" }), {
        status: 400,
      }),
    };
  }
  return { client_id };
}

// ---------------------------------------------------------------------------
// Testes de contrato
// ---------------------------------------------------------------------------

describe("generate-report — contrato HTTP", () => {
  it("retorna 401 sem Authorization header", () => {
    const req = new Request("http://edge/generate-report", { method: "POST" });
    const res = checkAuth(req);
    expect(res?.status).toBe(401);
  });

  it("retorna 200 (sem bloqueio de auth) quando Authorization está presente", () => {
    const req = new Request("http://edge/generate-report", {
      method: "POST",
      headers: { Authorization: "Bearer token123" },
    });
    expect(checkAuth(req)).toBeNull();
  });

  it("retorna 400 quando client_id está ausente no body", async () => {
    const req = new Request("http://edge/generate-report", {
      method: "POST",
      headers: {
        Authorization: "Bearer token123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const result = await checkBody(req);
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(400);
  });

  it("retorna 400 quando body está vazio", async () => {
    const req = new Request("http://edge/generate-report", {
      method: "POST",
      headers: { Authorization: "Bearer token123" },
      body: null,
    });
    const result = await checkBody(req);
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(400);
  });

  it("retorna 413 quando body excede limite de tamanho", async () => {
    const huge = "x".repeat(600_000);
    const req = new Request("http://edge/generate-report", {
      method: "POST",
      headers: {
        Authorization: "Bearer token123",
        "content-length": String(huge.length),
      },
      body: JSON.stringify({ client_id: huge }),
    });
    const result = await checkBody(req);
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(413);
  });

  it("passa validação com client_id válido", async () => {
    const req = new Request("http://edge/generate-report", {
      method: "POST",
      headers: {
        Authorization: "Bearer token123",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ client_id: "uuid-client-1" }),
    });
    const result = await checkBody(req);
    expect("client_id" in result).toBe(true);
    if ("client_id" in result) expect(result.client_id).toBe("uuid-client-1");
  });

  it("shape mínimo do response IA: executive_summary + confianca_analise", () => {
    const raw = JSON.stringify({
      executive_summary: "Análise completa do cliente.",
      confianca_analise: "alta",
      recommendations: [],
    });
    const parsed = parseAiJson(raw);
    expect(parsed.parseOk).toBe(true);
    expect(typeof parsed.json.executive_summary).toBe("string");
    expect(typeof parsed.json.confianca_analise).toBe("string");
  });
});
