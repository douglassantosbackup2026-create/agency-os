/**
 * Contrato HTTP — campaign-ai-audit
 *
 * Testa as guards de auth/body e a shape mínima do JSON retornado pela IA.
 * Não importa o handler Deno; usa as mesmas helpers de _shared.
 */
import { describe, expect, it } from "vitest";
import { BodyTooLargeError, readJsonBody } from "./edge-json-body";
import { parseAiJson } from "./ai-v3";
import { extractJsonFromModelText } from "./campaign-audit-helpers";

// ---------------------------------------------------------------------------
// Guard helpers — espelham campaign-ai-audit/index.ts
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
      return { response: new Response(JSON.stringify({ error: "payload demasiado grande" }), { status: 413 }) };
    }
    body = {};
  }
  const client_id = (body?.client_id as string | undefined) ?? "";
  if (!client_id) {
    return { response: new Response(JSON.stringify({ error: "client_id required" }), { status: 400 }) };
  }
  return { client_id };
}

// ---------------------------------------------------------------------------
// Testes de contrato
// ---------------------------------------------------------------------------

describe("campaign-ai-audit — contrato HTTP", () => {
  it("retorna 401 sem Authorization header", () => {
    const req = new Request("http://edge/campaign-ai-audit", { method: "POST" });
    const res = checkAuth(req);
    expect(res?.status).toBe(401);
  });

  it("não bloqueia quando Authorization está presente", () => {
    const req = new Request("http://edge/campaign-ai-audit", {
      method: "POST",
      headers: { Authorization: "Bearer jwt.token.here" },
    });
    expect(checkAuth(req)).toBeNull();
  });

  it("retorna 400 quando client_id está ausente", async () => {
    const req = new Request("http://edge/campaign-ai-audit", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ period_days: 30 }),
    });
    const result = await checkBody(req);
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(400);
  });

  it("retorna 400 com body completamente vazio", async () => {
    const req = new Request("http://edge/campaign-ai-audit", {
      method: "POST",
      headers: { Authorization: "Bearer t" },
      body: null,
    });
    const result = await checkBody(req);
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(400);
  });

  it("retorna 413 quando body excede limite", async () => {
    const huge = "x".repeat(600_000);
    const req = new Request("http://edge/campaign-ai-audit", {
      method: "POST",
      headers: {
        Authorization: "Bearer t",
        "content-length": String(huge.length),
      },
      body: huge,
    });
    const result = await checkBody(req);
    expect("response" in result).toBe(true);
    if ("response" in result) expect(result.response.status).toBe(413);
  });

  it("passa validação com client_id válido", async () => {
    const req = new Request("http://edge/campaign-ai-audit", {
      method: "POST",
      headers: { Authorization: "Bearer t", "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: "abc-123", period_days: 30 }),
    });
    const result = await checkBody(req);
    expect("client_id" in result).toBe(true);
    if ("client_id" in result) expect(result.client_id).toBe("abc-123");
  });

  it("shape mínima do response IA: executive_summary_markdown + overall_status + recommendations[]", () => {
    const modelOutput = `\`\`\`json
{"executive_summary_markdown":"## Análise","overall_status":"critical","recommendations":[{"campaign_id":"c1","suggestion_type":"pause"}]}
\`\`\``;
    const extracted = extractJsonFromModelText(modelOutput);
    const parsed = parseAiJson(extracted);
    expect(parsed.parseOk).toBe(true);
    expect(typeof parsed.json.executive_summary_markdown).toBe("string");
    expect(typeof parsed.json.overall_status).toBe("string");
    expect(Array.isArray(parsed.json.recommendations)).toBe(true);
  });

  it("overall_status aceita valores canônicos", () => {
    const validStatuses = ["healthy", "attention", "critical"];
    for (const status of validStatuses) {
      const raw = JSON.stringify({ executive_summary_markdown: "x", overall_status: status, recommendations: [] });
      const parsed = parseAiJson(raw);
      expect(parsed.parseOk).toBe(true);
      expect(validStatuses).toContain(parsed.json.overall_status);
    }
  });
});
