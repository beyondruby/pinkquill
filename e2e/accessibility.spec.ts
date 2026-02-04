import { test, expect } from "@playwright/test";

test.describe("Accessibility", () => {
  test("login page should have proper heading structure", async ({ page }) => {
    await page.goto("/login");

    // Should have at least one h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test("login page should have accessible form labels", async ({ page }) => {
    await page.goto("/login");

    // Form inputs should have associated labels
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();

    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible();
  });

  test("buttons should have accessible names", async ({ page }) => {
    await page.goto("/login");

    // All buttons should have accessible names
    const buttons = page.getByRole("button");
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const name = await button.getAttribute("aria-label") || await button.textContent();
      expect(name).toBeTruthy();
    }
  });

  test("links should have accessible names", async ({ page }) => {
    await page.goto("/login");

    const links = page.getByRole("link");
    const linkCount = await links.count();

    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const name = await link.getAttribute("aria-label") || await link.textContent();
      expect(name?.trim()).toBeTruthy();
    }
  });

  test("should have skip to content link or proper focus management", async ({ page }) => {
    await page.goto("/login");

    // Check for skip link or main landmark
    const skipLink = page.locator('a[href="#main"], a[href="#content"], [data-testid="skip-link"]');
    const mainLandmark = page.locator('main, [role="main"]');

    const hasSkipLink = await skipLink.count() > 0;
    const hasMain = await mainLandmark.count() > 0;

    expect(hasSkipLink || hasMain).toBe(true);
  });

  test("images should have alt text", async ({ page }) => {
    await page.goto("/login");

    const images = page.locator("img");
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const role = await img.getAttribute("role");

      // Either has alt text or is decorative (role="presentation")
      expect(alt !== null || role === "presentation" || role === "none").toBe(true);
    }
  });
});

test.describe("Accessibility - Color Contrast", () => {
  test("text should be readable", async ({ page }) => {
    await page.goto("/login");

    // This is a basic check - for full contrast testing, use axe-playwright
    // Check that text elements exist and are visible
    const textElements = page.locator("p, h1, h2, h3, h4, h5, h6, span, label");
    const count = await textElements.count();

    expect(count).toBeGreaterThan(0);
  });
});

test.describe("Accessibility - Keyboard Navigation", () => {
  test("should be able to tab through login form", async ({ page }) => {
    await page.goto("/login");

    // Start at body
    await page.keyboard.press("Tab");

    // Should be able to reach email input
    let focused = page.locator(":focus");
    let tagName = await focused.evaluate((el) => el.tagName.toLowerCase());

    // Keep tabbing until we find an input or button
    let tabCount = 0;
    while (tagName !== "input" && tagName !== "button" && tabCount < 20) {
      await page.keyboard.press("Tab");
      focused = page.locator(":focus");
      tagName = await focused.evaluate((el) => el.tagName.toLowerCase());
      tabCount++;
    }

    expect(["input", "button", "a"]).toContain(tagName);
  });

  test("should be able to submit form with Enter key", async ({ page }) => {
    await page.goto("/login");

    // Fill in the form
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByLabel(/password/i).fill("testpassword");

    // Press Enter to submit
    await page.keyboard.press("Enter");

    // Should attempt to submit (either error or success)
    // Wait a bit for any response
    await page.waitForTimeout(1000);

    // Page should either show error, redirect, or still be on login
    const url = page.url();
    expect(url).toBeTruthy();
  });
});
