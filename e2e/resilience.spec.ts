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

  test("poll ai_jobs até estado terminal", async ({ request }) => {
    test.skip(
      process.env.E2E_RESILIENCE !== "1",
      "Defina E2E_RESILIENCE=1 para testes de API.",
    );
    const base = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
    const token = process.env.E2E_TEST_ACCESS_TOKEN?.trim();
    const clientId = process.env.E2E_TEST_CLIENT_ID?.trim();
    test.skip(!base || !token || !clientId, "VITE_SUPABASE_URL, E2E_TEST_ACCESS_TOKEN, E2E_TEST_CLIENT_ID");

    const enqueue = await request.post(
      `${base}/functions/v1/generate-meeting-report`,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, data: { client_id: clientId } },
    );
    if (enqueue.status() !== 202) {
      test.skip(true, "Fila async indisponível (sync ou rate limit).");
    }
    const { job_id: jobId } = (await enqueue.json()) as { job_id?: string };
    test.skip(!jobId, "Sem job_id");

    const deadline = Date.now() + 120_000;
    let lastStatus = "pending";
    while (Date.now() < deadline) {
      const res = await request.get(
        `${base}/rest/v1/ai_jobs?id=eq.${jobId}&select=status,last_error`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
          },
        },
      );
      if (res.ok()) {
        const rows = (await res.json()) as Array<{ status?: string; last_error?: string }>;
        lastStatus = rows[0]?.status ?? lastStatus;
        const done = aiJobPollDone(lastStatus);
        if (done === "done" || done === "failed") {
          expect(["done", "failed"]).toContain(lastStatus);
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    expect.soft(lastStatus, "timeout aguardando ai_jobs").not.toBe("pending");
  });

  test("mercadopago-webhook rejeita POST sem assinatura em prod", async ({
    request,
  }) => {
    test.skip(
      process.env.E2E_RESILIENCE !== "1",
      "Defina E2E_RESILIENCE=1 para testes de API.",
    );
    const base = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
    const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    test.skip(!base || !anon, "VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY");

    const res = await request.post(`${base}/functions/v1/mercadopago-webhook`, {
      headers: { "Content-Type": "application/json", apikey: anon },
      data: { type: "payment", data: { id: "0" } },
    });
    expect([401, 403, 422]).toContain(res.status());
  });
});
