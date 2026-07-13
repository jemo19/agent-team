import { expect, test } from "@playwright/test";
test("shows quote", async ({ page }) => { await page.goto("/checkout"); await expect(page.locator("output")).toBeVisible(); });
