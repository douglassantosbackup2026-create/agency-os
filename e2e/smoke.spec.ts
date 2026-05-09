import { test, expect } from "@playwright/test";

const email =
  process.env.E2E_TEST_EMAIL?.trim() ?? process.env.PERF_TEST_EMAIL?.trim();
const password =
  process.env.E2E_TEST_PASSWORD?.trim() ??
  process.env.PERF_TEST_PASSWORD?.trim();

test("login e rotas clientes / relatórios", async ({ page }) => {
  test.skip(
    !email || !password,
    "Defina E2E_TEST_EMAIL e E2E_TEST_PASSWORD (ou PERF_* como fallback).",
  );

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await Promise.all([
    page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
      timeout: 120_000,
    }),
    page.locator("form button").click(),
  ]);

  await page.goto("/clients");
  await expect(page.locator("body")).toBeVisible();

  await page.goto("/reports");
  await expect(page.locator("body")).toBeVisible();
});
