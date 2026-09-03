/**
 * Commissions journey against the Phase 3 screens (rewritten in Phase 4c).
 *
 * seller publishes a listing through the six-step wizard → buyer requests it
 * from the listing page (RequestSheet) → dedicated checkout shows the
 * processing fee + total → pays with a Stripe test card inside embedded
 * Checkout → /checkout/[id]/complete confirms from the DATABASE (webhook) →
 * the order page shows the same numbers to both sides → seller starts and
 * delivers → buyer approves → receipt and payout statement exist.
 *
 * Needs a running app pointed at a Stripe TEST account with `stripe listen`
 * (or a registered test webhook) forwarding to it, plus two test accounts:
 *   E2E_SELLER_EMAIL / E2E_SELLER_PASSWORD  (seller with a finished studio setup)
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
const SELLER_NET = Math.round(PRICE_USD * 100 * 0.95) / 100; // 5% fee → $4.75

test.describe("Commissions journey (Phase 3 screens)", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!credentialsConfigured, "Set E2E_SELLER_EMAIL/E2E_SELLER_PASSWORD and E2E_BUYER_EMAIL/E2E_BUYER_PASSWORD to run");

  let serviceTitle = "";
  let commissionPath = "";
  let orderId = "";

  test.beforeAll(() => {
    serviceTitle = `E2E Commission ${Date.now()}`;
  });

  test("seller publishes a $5 commission through the wizard", async ({ page }, testInfo) => {
    test.skip(/Mobile/i.test(testInfo.project.name), "Desktop-only journey");
    test.setTimeout(180_000);

    await signIn(page, sellerEmail!, sellerPassword!);
    await page.goto("/sell/service");
    await expect(page.getByRole("heading", { name: "Basics" })).toBeVisible({ timeout: 20_000 });

    // 1 · Basics
    await page.getByRole("button", { name: "Illustration", exact: true }).click();
    await page.getByPlaceholder("Character illustration, full colour").fill(serviceTitle);
    await page.getByPlaceholder("One line under the title on cards and the listing.").fill("E2E money-path service");
    await page.getByPlaceholder("How you work, what you love making, what a buyer can expect.").fill("Automated test service used to verify the commissions path end to end.");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // 2 · Packages: one tier, $5, 3 days, 1 revision
    await page.getByPlaceholder("Sketch, Standard, Full scene…").first().fill("Starter");
    await page.locator('input[id^="pkg-price-"]').first().fill(String(PRICE_USD));
    await page.locator('input[id^="pkg-days-"]').first().fill("3");
    await page.locator('input[id^="pkg-rev-"]').first().fill("1");
    await page.getByPlaceholder("Half body, full render, loose background.").first().fill("One small deliverable.");
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // 3 · Portfolio
    await page.locator('input[type="file"]').first().setInputFiles(path.join(process.cwd(), "public/defaultprofile.png"));
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // 4 · Details, 5 · Availability keep their defaults (open, unlimited, no lead time)
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();

    // 6 · Preview → Publish
    await expect(page.getByRole("heading", { name: serviceTitle })).toBeVisible();
    await page.getByRole("button", { name: "Publish", exact: true }).click();

    await expect(page).toHaveURL(/\/commissions\/[^/?]+/, { timeout: 60_000 });
    commissionPath = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: serviceTitle })).toBeVisible({ timeout: 20_000 });
    await signOut(page);
  });

  test("buyer requests, sees the fee breakdown and pays with a test card", async ({ page }, testInfo) => {
    test.skip(/Mobile/i.test(testInfo.project.name), "Desktop-only journey");
    test.setTimeout(240_000);
    expect(commissionPath).toMatch(/^\/commissions\//);

    await signIn(page, buyerEmail!, buyerPassword!);
    await page.goto(commissionPath);
    await expect(page.getByRole("heading", { name: serviceTitle })).toBeVisible({ timeout: 20_000 });

    // Phase 2a: availability is decided by the database and shown before the CTA.
    await page.getByRole("button", { name: /^Request · \$/ }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: /^Continue/ }).click(); // package
    await sheet.getByPlaceholder(/What you want, the mood/i).fill("E2E brief: one concept, any style.");
    await sheet.getByRole("button", { name: /^Continue/ }).click(); // brief → references
    await sheet.getByRole("button", { name: /^Continue/ }).click(); // references → review
    const terms = sheet.getByRole("checkbox");
    if (await terms.count()) await terms.first().check();
    await sheet.getByRole("button", { name: /^Pay \$/ }).click();

    // Every paid request lands on the dedicated checkout page for a pending_payment order.
    await expect(page).toHaveURL(/\/checkout\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    orderId = page.url().split("/checkout/")[1];

    // Fee model is visible before any card is entered.
    await expect(page.getByText("Processing fee").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`$${BUYER_FEE.toFixed(2)}`).first()).toBeVisible();
    await expect(page.getByText(`$${TOTAL_USD.toFixed(2)}`).first()).toBeVisible();

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

    // The completion page never trusts the redirect: it polls the order until the webhook has recorded the payment.
    await expect(page).toHaveURL(new RegExp(`/checkout/${orderId}/complete`), { timeout: 60_000 });
    await expect(page.getByText(/Payment confirmed|Paid/).first()).toBeVisible({ timeout: 90_000 });

    // The order page: one rail, the buyer's numbers, a receipt.
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByText("Total paid")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`$${TOTAL_USD.toFixed(2)}`).first()).toBeVisible();
    await page.getByRole("link", { name: "Receipt" }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}/receipt`));
    await expect(page.getByRole("heading", { name: "Receipt" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Total paid")).toBeVisible();
    await signOut(page);
  });

  test("seller delivers, buyer approves, both sides see the same facts", async ({ browser, page }, testInfo) => {
    test.skip(/Mobile/i.test(testInfo.project.name), "Desktop-only journey");
    test.setTimeout(240_000);
    expect(orderId).toMatch(/^[0-9a-f-]{36}$/);

    await signIn(page, sellerEmail!, sellerPassword!);
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByText("You receive")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(`$${SELLER_NET.toFixed(2)}`).first()).toBeVisible();

    await page.getByRole("button", { name: "Start work", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Deliver work", exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Deliver work", exact: true }).first().click();
    const deliver = page.getByRole("dialog");
    await deliver.getByRole("textbox").first().fill("Delivered: one concept attached.");
    await deliver.locator('input[type="file"]').first().setInputFiles(path.join(process.cwd(), "public/defaultprofile.png"));
    await deliver.getByRole("button", { name: "Send delivery", exact: true }).click();
    await expect(page.getByRole("button", { name: "Deliver work", exact: true })).toHaveCount(0, { timeout: 30_000 });
    await signOut(page);

    const buyerContext = await browser.newContext();
    const buyerPage = await buyerContext.newPage();
    await signIn(buyerPage, buyerEmail!, buyerPassword!);
    await buyerPage.goto(`/orders/${orderId}`);
    await buyerPage.getByRole("button", { name: "Approve delivery", exact: true }).first().click();
    await expect(buyerPage.getByText(/^Approved/).first()).toBeVisible({ timeout: 20_000 });
    // Money stays held for the release window; nothing is paid out during the test.
    await expect(buyerPage.getByRole("button", { name: /Cancel order/i })).toHaveCount(0);
    await signOut(buyerPage);
    await buyerContext.close();

    // The seller's payout exists and its statement opens.
    await signIn(page, sellerEmail!, sellerPassword!);
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByRole("link", { name: "Payout statement" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("link", { name: "Payout statement" }).click();
    await expect(page.getByRole("heading", { name: "Payout statement" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("You receive")).toBeVisible();
    await signOut(page);
  });
});

test.describe("Seller studio and console gates", () => {
  test.skip(!credentialsConfigured, "Set E2E_SELLER_EMAIL/E2E_SELLER_PASSWORD and E2E_BUYER_EMAIL/E2E_BUYER_PASSWORD to run");

  test("the seller studio renders its screens", async ({ page }, testInfo) => {
    test.skip(/Mobile/i.test(testInfo.project.name), "Desktop-only");
    await signIn(page, sellerEmail!, sellerPassword!);
    for (const [href, heading] of [["/seller/dashboard", "Dashboard"], ["/seller/orders", "Orders"], ["/seller/earnings", "Earnings"], ["/seller/analytics", "Analytics"]] as const) {
      await page.goto(href);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible({ timeout: 20_000 });
    }
    await signOut(page);
  });

  test("the console is closed to non-operators", async ({ page }) => {
    await signIn(page, buyerEmail!, buyerPassword!);
    await page.goto("/admin");
    await expect(page.getByText(/for Pinkquill operators/i)).toBeVisible({ timeout: 20_000 });
    await signOut(page);
  });
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder(/Email or username|Email/i).first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

async function signOut(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
}
