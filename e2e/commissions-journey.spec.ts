/**
 * Commissions money journey (Phase 1e).
 *
 * seller publishes a service → buyer hires → dedicated checkout shows the
 * processing fee + total → pays with a Stripe test card inside embedded
 * Checkout → /checkout/[id]/complete confirms from the DATABASE (webhook) →
 * seller starts + delivers → buyer accepts → order completed.
 *
 * Needs a running app pointed at a Stripe TEST account with `stripe listen`
 * (or a registered test webhook) forwarding to it, plus two test accounts:
 *   E2E_SELLER_EMAIL / E2E_SELLER_PASSWORD  (seller with a payable test Connect account)
 *   E2E_BUYER_EMAIL  / E2E_BUYER_PASSWORD
 * Skipped otherwise. Never run against live keys.
 */
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

const sellerEmail = process.env.E2E_SELLER_EMAIL;
const sellerPassword = process.env.E2E_SELLER_PASSWORD;
const buyerEmail = process.env.E2E_BUYER_EMAIL;
const buyerPassword = process.env.E2E_BUYER_PASSWORD;

const credentialsConfigured = Boolean(sellerEmail && sellerPassword && buyerEmail && buyerPassword);

const PRICE_USD = 5; // min_service_price floor
const BUYER_FEE = Math.round(PRICE_USD * 100 * 0.035 + 30) / 100; // 3.5% + $0.30 → $0.48
const TOTAL_USD = PRICE_USD + BUYER_FEE; // $5.48

test.describe("Commissions money journey", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!credentialsConfigured, "Set E2E_SELLER_EMAIL/E2E_SELLER_PASSWORD and E2E_BUYER_EMAIL/E2E_BUYER_PASSWORD to run");

  let serviceTitle = "";
  let commissionPath = "";
  let orderId = "";

  test.beforeAll(() => {
    serviceTitle = `E2E Commission ${Date.now()}`;
  });

  test("seller publishes a $5 commission service", async ({ page }, testInfo) => {
    test.skip(/Mobile/i.test(testInfo.project.name), "Desktop-only journey");
    test.setTimeout(180_000);

    await signIn(page, sellerEmail!, sellerPassword!);
    await page.goto("/sell/service");
    await expect(page).toHaveURL(/\/sell\/service/, { timeout: 20_000 });

    await page.getByRole("button", { name: "Design" }).click();
    await page.getByRole("button", { name: "UI/UX Design" }).click();
    await page.getByPlaceholder("I will design a conversion-ready landing page for your brand").fill(serviceTitle);
    await page.getByPlaceholder("Fast delivery, strategic UX, and copy-ready handoff").fill("E2E money-path service");
    await page
      .getByPlaceholder("Describe your process, what buyers get, and why your approach is different.")
      .fill("Automated test service used to verify the commissions payment path end to end.");
    await page.getByRole("button", { name: /^Continue$/ }).click();

    await page.getByPlaceholder("Package name").first().fill("Starter");
    await page.getByPlaceholder("Price \(USD\)").first().fill(String(PRICE_USD));
    await page.getByPlaceholder("Describe scope and deliverables.").first().fill("One small deliverable.");
    await page.getByPlaceholder("Delivery days").first().fill("3");
    await page.getByPlaceholder("Revisions").first().fill("1");
    await page.getByRole("button", { name: /\+ Add line/i }).first().click();
    await page.getByPlaceholder("e.g., 3 design concepts, source file, commercial use").first().fill("One concept");
    await page.getByRole("button", { name: /^Continue$/ }).click();

    await page.locator('input[type="file"]').first().setInputFiles(path.join(process.cwd(), "public/defaultprofile.png"));
    await page.getByRole("button", { name: /^Continue$/ }).click();
    await page.getByRole("button", { name: /Publish Service/i }).click();

    await expect(page).toHaveURL(/\/studio\/[^/]+\?tab=commissions/, { timeout: 120_000 });
    const card = page.locator('a[href^="/commissions/"]').filter({ hasText: serviceTitle }).first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    commissionPath = (await card.getAttribute("href")) || "";
    expect(commissionPath).toMatch(/^\/commissions\//);
    await signOut(page);
  });

  test("buyer hires, sees the fee breakdown and pays with a test card", async ({ page }, testInfo) => {
    test.skip(/Mobile/i.test(testInfo.project.name), "Desktop-only journey");
    test.setTimeout(240_000);
    expect(commissionPath).toMatch(/^\/commissions\//);

    await signIn(page, buyerEmail!, buyerPassword!);
    await page.goto(commissionPath);
    await expect(page.getByRole("heading", { name: serviceTitle })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /Hire Creator/i }).click();
    await page
      .getByPlaceholder("Describe goals, style references, scope, and must-have deliverables.")
      .fill("E2E brief: one concept, any style.");
    await page.getByRole("button", { name: /Confirm & Start Order/i }).click();

    // Every paid hire lands on the dedicated checkout page for a pending_payment order.
    await expect(page).toHaveURL(/\/checkout\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    orderId = page.url().split("/checkout/")[1];

    // Fee model is visible before any card is entered.
    const summary = page.locator("body");
    await expect(summary.getByText("Processing fee")).toBeVisible({ timeout: 20_000 });
    await expect(summary.getByText(`$${BUYER_FEE.toFixed(2)}`).first()).toBeVisible();
    await expect(summary.getByText(`$${TOTAL_USD.toFixed(2)}`).first()).toBeVisible();

    // Embedded Stripe Checkout (card only). Test card 4242…, any future expiry.
    const checkout = page.frameLocator('iframe[name^="embedded-checkout"], iframe[src*="checkout.stripe.com"]').first();
    await checkout.getByLabel(/Card number/i).fill("4242424242424242");
    await checkout.getByLabel(/Expiration/i).fill("12/34");
    await checkout.getByLabel(/CVC/i).fill("123");
    const name = checkout.getByLabel(/Name on card|Cardholder name/i);
    if (await name.isVisible().catch(() => false)) await name.fill("E2E Buyer");
    const postal = checkout.getByLabel(/ZIP|Postal/i);
    if (await postal.isVisible().catch(() => false)) await postal.fill("12345");
    await checkout.getByRole("button", { name: /^Pay/i }).click();

    // The completion page never trusts the redirect: it polls the order until the
    // webhook has recorded the payment.
    await expect(page).toHaveURL(new RegExp(`/checkout/${orderId}/complete`), { timeout: 60_000 });
    await expect(page.getByText("Payment confirmed")).toBeVisible({ timeout: 90_000 });

    await page.goto(`/orders/${orderId}`);
    await expect(page.getByText("Total paid")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`$${TOTAL_USD.toFixed(2)}`).first()).toBeVisible();
    await signOut(page);
  });

  test("seller delivers, buyer accepts, order completes", async ({ browser, page }, testInfo) => {
    test.skip(/Mobile/i.test(testInfo.project.name), "Desktop-only journey");
    test.setTimeout(240_000);
    expect(orderId).toMatch(/^[0-9a-f-]{36}$/);

    await signIn(page, sellerEmail!, sellerPassword!);
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByText("You receive")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /^Start Work$/ }).click();
    await expect(page.getByRole("button", { name: /^Submit Delivery$/ })).toBeVisible({ timeout: 20_000 });
    const note = page.getByPlaceholder(/delivery summary|notes for buyer/i).first();
    if (await note.isVisible().catch(() => false)) await note.fill("Delivered: one concept attached.");
    await page.getByRole("button", { name: /^Submit Delivery$/ }).click();
    await expect(page.getByRole("button", { name: /^Submit Delivery$/ })).toBeHidden({ timeout: 20_000 });
    await signOut(page);

    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();
    await signIn(buyerPage, buyerEmail!, buyerPassword!);
    await buyerPage.goto(`/orders/${orderId}`);
    await buyerPage.getByRole("button", { name: /^Accept Delivery$/ }).click();
    await expect(buyerPage.getByText(/completed/i).first()).toBeVisible({ timeout: 20_000 });
    // Money stays in escrow for the release window; nothing is paid out during the test.
    await expect(buyerPage.getByRole("button", { name: /Cancel order/i })).toHaveCount(0);
    await signOut(buyerPage);
    await buyerContext.close();
  });
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder(/Email or username|Email/i).first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /^Sign In$/ }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

async function signOut(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
}
