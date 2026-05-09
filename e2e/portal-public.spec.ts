import { test, expect } from "@playwright/test";

/** Portal público sem login: slug inválido deve falhar com cópia amigável (regressão pós-RLS). */
test("portal cliente slug inválido mostra indisponível", async ({ page }) => {
  await page.goto("/p/__invalid_slug_xyz___");
  await expect(
    page.getByRole("heading", { name: /Portal indisponível/i }),
  ).toBeVisible({ timeout: 30_000 });
});
