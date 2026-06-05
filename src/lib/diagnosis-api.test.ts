import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callDiagnosisApi, DiagnosisApiError } from "./diagnosis-api";

vi.mock("@/lib/diagnosis-invoke", () => ({
  invokeDiagnosisFunction: vi.fn(),
}));

vi.mock("@/lib/report-error", () => ({
  reportError: vi.fn(),
}));

import { invokeDiagnosisFunction } from "@/lib/diagnosis-invoke";

const mockInvoke = vi.mocked(invokeDiagnosisFunction);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("callDiagnosisApi", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed body on 200", async () => {
    mockInvoke.mockResolvedValue(
      jsonResponse(200, { diagnosis_id: "abc", secret_slug: "s1" }),
    );
    const result = await callDiagnosisApi<{ diagnosis_id: string }>(
      "start-diagnosis-payment",
      { method: "POST" },
    );
    expect(result.diagnosis_id).toBe("abc");
  });

  it("throws DiagnosisApiError with server message on 404", async () => {
    mockInvoke.mockResolvedValue(
      jsonResponse(404, { error: "diagnóstico não encontrado" }),
    );
    await expect(callDiagnosisApi("diagnosis-status")).rejects.toMatchObject({
      status: 404,
      message: "diagnóstico não encontrado",
    });
  });

  it("maps too_many_requests to friendly message on 429", async () => {
    mockInvoke.mockResolvedValue(jsonResponse(429, { error: "too_many_requests" }));
    await expect(callDiagnosisApi("create-diagnosis-checkout")).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof DiagnosisApiError &&
        e.status === 429 &&
        e.message.includes("Muitas tentativas"),
    );
  });

  it("handles invalid JSON body on error response", async () => {
    mockInvoke.mockResolvedValue(
      new Response("not json", { status: 502, statusText: "Bad Gateway" }),
    );
    await expect(callDiagnosisApi("diagnosis-report")).rejects.toMatchObject({
      status: 502,
    });
  });

  it("wraps network failures", async () => {
    mockInvoke.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(callDiagnosisApi("diagnosis-status")).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("rede"),
    });
  });

  it("maps mp_credentials_environment_mismatch by code", async () => {
    mockInvoke.mockResolvedValue(
      jsonResponse(401, {
        error: "unauthorized",
        code: "mp_credentials_environment_mismatch",
      }),
    );
    await expect(
      callDiagnosisApi("process-diagnosis-payment"),
    ).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof DiagnosisApiError &&
        e.code === "mp_credentials_environment_mismatch" &&
        e.message.includes("Mercado Pago"),
    );
  });
});
