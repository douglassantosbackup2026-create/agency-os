import { test, expect } from "@playwright/test";

test("página de login carrega (smoke público)", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[type="email"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator("form button")).toBeVisible();
});
