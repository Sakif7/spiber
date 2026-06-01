import { test, expect } from "@playwright/test";

test("root redirects to the default locale", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("Bangla locale renders with lang=bn", async ({ page }) => {
  await page.goto("/bn");
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
});

test("division hub shows a Coming soon empty state", async ({ page }) => {
  await page.goto("/en/instruments");
  await expect(
    page.getByRole("heading", { name: /coming soon/i }),
  ).toBeVisible();
});

test("admin redirects to login when unauthenticated", async ({ page }) => {
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/\/en\/login/);
});

test("contact form submits and acknowledges", async ({ page }) => {
  await page.goto("/en/contact");
  await page.fill("#name", "Test User");
  await page.fill("#email", "test@example.com");
  await page.fill("#message", "Hello from the e2e test.");
  await page.getByRole("button", { name: /send message/i }).click();
  await expect(page.getByText(/received/i)).toBeVisible();
});
