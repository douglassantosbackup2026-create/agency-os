import { test, expect } from "@playwright/test";

const email =
  process.env.E2E_TEST_EMAIL?.trim() ?? process.env.PERF_TEST_EMAIL?.trim();
const password =
  process.env.E2E_TEST_PASSWORD?.trim() ??
  process.env.PERF_TEST_PASSWORD?.trim();

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email!);
  await page.locator('input[type="password"]').fill(password!);
  await Promise.all([
    page.waitForFunction(() => !window.location.pathname.startsWith("/login"), {
      timeout: 120_000,
    }),
    page.locator("form button").click(),
  ]);
}

test.describe("Rotas autenticadas (regressão pré-produção)", () => {
  test("dashboard e onboarding respondem após login", async ({ page }) => {
    test.skip(
      !email || !password,
      "Defina E2E_TEST_EMAIL e E2E_TEST_PASSWORD (ou PERF_*).",
    );

    await login(page);

    await page.goto("/dashboard");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 30_000,
    });

    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { name: /Configuração inicial/i }),
    ).toBeVisible({ timeout: 30_000 });
  });
});
