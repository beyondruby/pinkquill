import { test, expect } from "@playwright/test";

test.describe("Homepage / Feed", () => {
  test("should allow guest browsing without redirecting to login", async ({ page }) => {
    await page.goto("/");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("Homepage - Authenticated", () => {
  // Skip these tests until auth setup is complete
  test.skip("should display feed when logged in", async ({ page }) => {
    await page.goto("/");

    // Feed container should be visible
    await expect(page.locator('[data-testid="feed"], .feed, main')).toBeVisible();
  });

  test.skip("should show create post button", async ({ page }) => {
    await page.goto("/");

    // Create button should be visible in sidebar or header
    await expect(page.getByRole("link", { name: /create/i })).toBeVisible();
  });

  test.skip("should show navigation sidebar on desktop", async ({ page }) => {
    await page.goto("/");

    // Sidebar with nav links
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("link", { name: /home/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /explore/i })).toBeVisible();
  });

  test.skip("should navigate to explore page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /explore/i }).click();
    await expect(page).toHaveURL(/explore/);
  });

  test.skip("should navigate to saved posts", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /saved/i }).click();
    await expect(page).toHaveURL(/saved/);
  });

  test.skip("should navigate to messages", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /messages/i }).click();
    await expect(page).toHaveURL(/messages/);
  });
});
