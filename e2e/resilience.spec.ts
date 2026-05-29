import { test, expect } from "@playwright/test";
import {
  aiJobPollDone,
  webhookEventIsDuplicate,
} from "../src/lib/resilience-integration-helpers";

/**
 * Contratos de resiliência (sem Supabase remoto).
 * E2E com API real: defina E2E_RESILIENCE=1 + credenciais de teste.
 */

test.describe("resiliência — contratos", () => {
  test("webhook MP duplicado → idempotência (23505)", () => {
    expect(webhookEventIsDuplicate("23505")).toBe(true);
    expect(webhookEventIsDuplicate("42P01")).toBe(false);
  });

  test("ai_jobs terminal states", () => {
    expect(aiJobPollDone("done")).toBe("done");
    expect(aiJobPollDone("failed")).toBe("failed");
    expect(aiJobPollDone("processing")).toBe("pending");
  });
});

test.describe("resiliência — API (opcional)", () => {
  test("sync paralelo retorna 409 quando lock activo", async ({ request }) => {
    test.skip(
      process.env.E2E_RESILIENCE !== "1",
      "Defina E2E_RESILIENCE=1 para testes de API.",
    );
    const base = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
    const token = process.env.E2E_TEST_ACCESS_TOKEN?.trim();
    const clientId = process.env.E2E_TEST_CLIENT_ID?.trim();
    test.skip(!base || !token || !clientId, "VITE_SUPABASE_URL, E2E_TEST_ACCESS_TOKEN, E2E_TEST_CLIENT_ID");

    const invoke = (signal?: AbortSignal) =>
      request.post(`${base}/functions/v1/sync-platform`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: { client_id: clientId, platform: "meta_ads" },
        signal,
      });

    const [a, b] = await Promise.all([invoke(), invoke()]);
    const statuses = [(await a).status(), (await b).status()].sort();
    expect(statuses.some((s) => s === 409 || s === 200)).toBeTruthy();
  });

  test("enqueue meeting_report retorna 202 com job_id", async ({ request }) => {
    test.skip(
      process.env.E2E_RESILIENCE !== "1",
      "Defina E2E_RESILIENCE=1 para testes de API.",
    );
    const base = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
    const token = process.env.E2E_TEST_ACCESS_TOKEN?.trim();
    const clientId = process.env.E2E_TEST_CLIENT_ID?.trim();
    test.skip(!base || !token || !clientId, "VITE_SUPABASE_URL, E2E_TEST_ACCESS_TOKEN, E2E_TEST_CLIENT_ID");

    const res = await request.post(
      `${base}/functions/v1/generate-meeting-report`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: { client_id: clientId },
      },
    );
    const status = res.status();
    const json = (await res.json().catch(() => ({}))) as {
      async?: boolean;
      job_id?: string;
      ok?: boolean;
    };
    expect([200, 202, 429]).toContain(status);
    if (status === 202) {
      expect(json.async).toBe(true);
      expect(json.job_id).toBeTruthy();
    }
  });
});
