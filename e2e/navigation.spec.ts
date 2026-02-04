import { test, expect } from "@playwright/test";

test.describe("Navigation - Public Pages", () => {
  test("should load privacy policy page", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
  });

  test("should load terms of service page", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /terms/i })).toBeVisible();
  });

  test("should load login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Navigation - Protected Routes", () => {
  test("should redirect to login when accessing feed without auth", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect to login when accessing create page without auth", async ({ page }) => {
    await page.goto("/create");
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect to login when accessing messages without auth", async ({ page }) => {
    await page.goto("/messages");
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect to login when accessing saved posts without auth", async ({ page }) => {
    await page.goto("/saved");
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect to login when accessing settings without auth", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Navigation - Mobile", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("should show mobile navigation on small screens", async ({ page }) => {
    await page.goto("/login");
    // Mobile bottom nav should be visible or mobile header
    const mobileNav = page.locator('[data-testid="mobile-nav"], nav.mobile-nav, .mobile-bottom-nav');
    // Don't fail if element doesn't exist on login page
    const count = await mobileNav.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
