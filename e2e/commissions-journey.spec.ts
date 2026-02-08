import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

const sellerEmail = process.env.E2E_SELLER_EMAIL;
const sellerPassword = process.env.E2E_SELLER_PASSWORD;
const buyerEmail = process.env.E2E_BUYER_EMAIL;
const buyerPassword = process.env.E2E_BUYER_PASSWORD;

const credentialsConfigured = Boolean(
  sellerEmail && sellerPassword && buyerEmail && buyerPassword
);

test.describe("Commissions Journey", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !credentialsConfigured,
    "Set E2E_SELLER_EMAIL/E2E_SELLER_PASSWORD and E2E_BUYER_EMAIL/E2E_BUYER_PASSWORD to run commissions E2E"
  );

  let serviceTitle = "";
  let commissionPath = "";
  let orderPath = "";

  test.beforeAll(() => {
    serviceTitle = `E2E Commission ${Date.now()}`;
  });

  test("seller creates a commission service from the Create menu", async ({ page }, testInfo) => {
    test.skip(/Mobile/i.test(testInfo.project.name), "Desktop-only journey");
    test.setTimeout(180_000);

    await signIn(page, sellerEmail!, sellerPassword!);

    const createButton = page.getByRole("button", { name: /create/i }).first();
    await expect(createButton).toBeVisible({ timeout: 20_000 });
    await createButton.click();

    const addServiceButton = page.getByRole("button", { name: /add service/i }).first();
    await expect(addServiceButton).toBeVisible();
    await addServiceButton.click();

    await expect(page).toHaveURL(/\/sell\/service/, { timeout: 20_000 });

    await page.getByRole("button", { name: "Design" }).click();
    await page.getByRole("button", { name: "UI/UX Design" }).click();

    await page
      .getByPlaceholder("I will design a conversion-ready landing page for your brand")
      .fill(serviceTitle);

    await page
      .getByPlaceholder("Fast delivery, strategic UX, and copy-ready handoff")
      .fill("Fast, conversion-focused UX with clear communication");

    await page
      .getByPlaceholder("Describe your process, what buyers get, and why your approach is different.")
      .fill(
        "I design conversion-first landing page experiences with UX rationale, polished UI, and implementation-ready files."
      );

    await page.getByRole("button", { name: /^Continue$/ }).click();

    await page.getByPlaceholder("Package name").first().fill("Starter Landing Page");
    await page.getByPlaceholder("Price \(USD\)").first().fill("199");
    await page
      .getByPlaceholder("Describe scope and deliverables.")
      .first()
      .fill("1 landing page design, responsive layouts, and delivery-ready assets.");

    await page.getByPlaceholder("Delivery days").first().fill("3");
    await page.getByPlaceholder("Revisions").first().fill("2");

    await page.getByRole("button", { name: /\+ Add line/i }).first().click();
    await page
      .getByPlaceholder("e.g., 3 design concepts, source file, commercial use")
      .first()
      .fill("Responsive desktop and mobile screens");

    await page.getByRole("button", { name: /^Continue$/ }).click();

    const mediaInput = page.locator('input[type="file"]').first();
    await mediaInput.setInputFiles(path.join(process.cwd(), "public/defaultprofile.png"));

    const requirementsSection = page
      .locator("section, div")
      .filter({ has: page.getByText("Buyer requirements") })
      .first();
    await requirementsSection.getByRole("button", { name: /\+ Add line/i }).first().click();
    await requirementsSection
      .getByPlaceholder("e.g., Brand guidelines, references, target audience")
      .first()
      .fill("Brand guidelines and target audience details");

    await page.getByRole("button", { name: /^Continue$/ }).click();
    await page.getByRole("button", { name: /Publish Service/i }).click();

    await expect(page).toHaveURL(/\/studio\/[^/]+\?tab=commissions/, {
      timeout: 120_000,
    });

    const card = page
      .locator('a[href^="/commissions/"]')
      .filter({ hasText: serviceTitle })
      .first();

    await expect(card).toBeVisible({ timeout: 30_000 });
    commissionPath = (await card.getAttribute("href")) || "";
    expect(commissionPath).toMatch(/^\/commissions\//);

    await signOut(page);
  });

  test("buyer discovers and hires the new commission", async ({ page }, testInfo) => {
    test.skip(/Mobile/i.test(testInfo.project.name), "Desktop-only journey");
    test.setTimeout(180_000);

    await signIn(page, buyerEmail!, buyerPassword!);

    await page.goto("/shop?section=commissions");

    await expect(page.getByRole("button", { name: /commissions/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    const searchInput = page.getByPlaceholder(/Search commissions|Search products/i).first();
    await searchInput.fill(serviceTitle);
    await page.waitForTimeout(700);

    const discoveryCard = page
      .locator('a[href^="/commissions/"]')
      .filter({ hasText: serviceTitle })
      .first();

    await expect(discoveryCard).toBeVisible({ timeout: 30_000 });
    const discoveredPath = (await discoveryCard.getAttribute("href")) || "";
    expect(discoveredPath).toBe(commissionPath);
    await discoveryCard.click();

    await expect(page).toHaveURL(/\/commissions\//, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: serviceTitle })).toBeVisible();

    await page.getByRole("button", { name: /Hire Creator/i }).click();

    await expect(page.getByRole("heading", { name: /Hire this package/i })).toBeVisible();
    await page
      .getByPlaceholder("Describe goals, style references, scope, and must-have deliverables.")
      .fill(
        "Need a SaaS landing page designed for conversion with clear hierarchy and strong CTA placement."
      );

    await page
      .locator('label:has-text("Target timeline (days)")')
      .locator("..")
      .locator("input")
      .fill("5");
    await page.getByPlaceholder("Links, files, constraints").fill("Brand colors are teal and charcoal.");

    await page.getByRole("button", { name: /Confirm & Start Order/i }).click();

    await expect(page).toHaveURL(/\/commissions\/orders\/[^/]+$/, { timeout: 30_000 });
    await expect(page.getByText(/Status:/i)).toBeVisible();
    await expect
      .poll(async () => (await page.locator("body").innerText()).toLowerCase(), {
        timeout: 20_000,
      })
      .toContain("status: paid");

    orderPath = new URL(page.url()).pathname;
    expect(orderPath).toMatch(/^\/commissions\/orders\//);

    await signOut(page);
  });

  test("seller delivers and buyer completes the commission", async ({ browser, page }, testInfo) => {
    test.skip(/Mobile/i.test(testInfo.project.name), "Desktop-only journey");
    test.setTimeout(240_000);
    expect(orderPath).toMatch(/^\/commissions\/orders\//);

    await signIn(page, sellerEmail!, sellerPassword!);
    await page.goto(orderPath);

    await expect(page.getByRole("button", { name: /Start Work/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Start Work/i }).click();

    await expect
      .poll(async () => (await page.locator("body").innerText()).toLowerCase(), {
        timeout: 20_000,
      })
      .toContain("status: in progress");

    await page
      .getByPlaceholder("Add delivery summary, links, and notes for buyer review.")
      .fill("Initial design delivery complete. Includes desktop + mobile layout files.");

    await page.getByRole("button", { name: /Submit Delivery/i }).click();

    await expect
      .poll(async () => (await page.locator("body").innerText()).toLowerCase(), {
        timeout: 20_000,
      })
      .toContain("status: submitted");

    await signOut(page);

    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();

    await signIn(buyerPage, buyerEmail!, buyerPassword!);
    await buyerPage.goto(orderPath);

    await expect(buyerPage.getByRole("button", { name: /Mark Complete/i })).toBeVisible({ timeout: 20_000 });
    await buyerPage.getByRole("button", { name: /Mark Complete/i }).click();

    await expect
      .poll(async () => (await buyerPage.locator("body").innerText()).toLowerCase(), {
        timeout: 20_000,
      })
      .toContain("status: completed");

    await signOut(buyerPage);
    await buyerContext.close();
  });
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");

  const welcomeHeading = page.getByRole("heading", { name: /welcome back/i }).first();
  if (!(await welcomeHeading.isVisible().catch(() => false))) {
    const signInToggle = page.getByRole("button", { name: /sign in/i }).first();
    if (await signInToggle.isVisible().catch(() => false)) {
      await signInToggle.click();
    }
  }

  await page.getByPlaceholder(/Email or username|Email/i).first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /^Sign In$/ }).click();

  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /create/i }).first()).toBeVisible({ timeout: 30_000 });
}

async function signOut(page: Page) {
  const moreButton = page.getByRole("button", { name: /more/i }).first();
  if (!(await moreButton.isVisible().catch(() => false))) {
    await page.goto("/");
  }

  await expect(page.getByRole("button", { name: /more/i }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /more/i }).first().click();
  await page.getByRole("button", { name: /log out/i }).first().click();

  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
}
