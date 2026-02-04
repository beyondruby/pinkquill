import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("should display login page", async ({ page }) => {
    await expect(page).toHaveTitle(/Quill/);
    await expect(page.getByRole("heading", { name: /sign in|log in|welcome/i })).toBeVisible();
  });

  test("should show email and password inputs", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.getByLabel(/email/i).fill("invalid@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible({ timeout: 10000 });
  });

  test("should have link to sign up", async ({ page }) => {
    await expect(page.getByText(/sign up|create account|register/i)).toBeVisible();
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/");
    // Should redirect to login or show login prompt
    await expect(page).toHaveURL(/login|signin/);
  });
});

test.describe("Authentication - Logged In", () => {
  // This test requires authentication setup
  // Use Playwright's storageState for authenticated tests
  test.skip("should show user menu when logged in", async ({ page }) => {
    // TODO: Implement with authenticated storage state
    await page.goto("/");
    await expect(page.getByRole("button", { name: /profile|menu/i })).toBeVisible();
  });

  test.skip("should be able to log out", async ({ page }) => {
    // TODO: Implement with authenticated storage state
    await page.goto("/");
    await page.getByRole("button", { name: /profile|menu/i }).click();
    await page.getByRole("menuitem", { name: /log out|sign out/i }).click();
    await expect(page).toHaveURL(/login/);
  });
});
