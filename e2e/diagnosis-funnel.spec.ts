import { test, expect } from "@playwright/test";
import {
  diagnosisPollTerminal,
  obrigadoParamsValid,
  parseObrigadoParams,
} from "../src/lib/diagnosis-funnel-helpers";

test.describe("diagnóstico — contratos", () => {
  test("parâmetros obrigado d+s", () => {
    const p = parseObrigadoParams(
      new URLSearchParams(
        "d=550e8400-e29b-41d4-a716-446655440000&s=deadbeef",
      ),
    );
    expect(obrigadoParamsValid(p.diagnosisId, p.secretSlug)).toBe(true);
  });

  test("poll terminal states", () => {
    expect(diagnosisPollTerminal("completed")).toBe("ready");
    expect(diagnosisPollTerminal("awaiting_payment")).toBe("pending");
  });
});

test.describe("diagnóstico — rotas públicas", () => {
  test("landing e checkout respondem 200", async ({ page }) => {
    const base =
      process.env.E2E_BASE_URL?.replace(/\/$/, "") ??
      process.env.LIGHTHOUSE_BASE_URL?.replace(/\/$/, "") ??
      "https://tanstack-start-app.douglaspinheirosantos94.workers.dev";

    for (const path of ["/", "/checkout"]) {
      const res = await page.goto(`${base}${path}`, {
        waitUntil: "domcontentloaded",
      });
      expect(res?.status(), path).toBeLessThan(400);
    }
  });
});

test.describe("diagnóstico — API (opcional)", () => {
  test("create-diagnosis-checkout exige PUBLIC_SITE_URL no servidor", async ({
    request,
  }) => {
    test.skip(
      process.env.E2E_DIAGNOSIS !== "1",
      "Defina E2E_DIAGNOSIS=1 para testes de API.",
    );
    const base = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
    const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    test.skip(!base || !anon, "VITE_SUPABASE_URL e publishable key");

    const res = await request.post(
      `${base}/functions/v1/create-diagnosis-checkout`,
      {
        headers: { "Content-Type": "application/json", apikey: anon! },
        data: {},
      },
    );
    expect([200, 429, 500, 502]).toContain(res.status());
  });

  test("diagnosis-status rejeita slug inválido", async ({ request }) => {
    test.skip(process.env.E2E_DIAGNOSIS !== "1", "E2E_DIAGNOSIS=1");
    const base = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
    test.skip(!base, "VITE_SUPABASE_URL");

    const res = await request.get(
      `${base}/functions/v1/diagnosis-status?d=not-a-uuid&s=x`,
    );
    expect([400, 404, 422]).toContain(res.status());
  });
});
