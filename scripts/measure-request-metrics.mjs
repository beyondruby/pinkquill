import { chromium } from "@playwright/test";

const baseUrl = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
const routeWaitMs = Number(process.env.METRICS_WAIT_MS || 5000);
const storageStatePath = process.env.PLAYWRIGHT_STORAGE_STATE || "";

function sortByCount(entries) {
  return entries.sort((a, b) => b[1] - a[1]);
}

function formatSummary(routeKey, data) {
  const endpointEntries = sortByCount(Object.entries(data.byEndpoint || {}));
  return {
    route: routeKey,
    total: data.total || 0,
    ok: data.ok || 0,
    badRequest: data.badRequest || 0,
    clientError: data.clientError || 0,
    serverError: data.serverError || 0,
    networkError: data.networkError || 0,
    avgDurationMs: data.avgDurationMs || 0,
    topEndpoints: endpointEntries.slice(0, 5),
  };
}

async function resetMetrics(page) {
  await page.evaluate(() => {
    const metrics = window.__pinkquillRequestMetrics;
    metrics?.reset();
    metrics?.setScope(null);
  });
}

async function readSnapshot(page) {
  return page.evaluate(() => window.__pinkquillRequestMetrics?.snapshot?.() || null);
}

function findRoute(snapshot, predicate) {
  if (!snapshot?.routes) return null;
  for (const [key, value] of Object.entries(snapshot.routes)) {
    if (predicate(key)) {
      return formatSummary(key, value);
    }
  }
  return null;
}

async function captureRoute(page, path) {
  await resetMetrics(page);
  await page.goto(`${baseUrl}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(routeWaitMs);
  const snapshot = await readSnapshot(page);
  return findRoute(snapshot, (key) => key === path);
}

async function captureProfileRoute(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(routeWaitMs);

  const profilePath = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="/studio/"]'));
    const profileLink = links.find((link) => {
      const href = link.getAttribute("href") || "";
      return /^\/studio\/[^/]+$/.test(href);
    });
    return profileLink?.getAttribute("href") || "/studio/nonexistent-user";
  });

  await resetMetrics(page);
  await page.goto(`${baseUrl}${profilePath}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(routeWaitMs);
  const snapshot = await readSnapshot(page);

  return {
    profilePath,
    summary: findRoute(snapshot, (key) => key === profilePath),
  };
}

async function captureNotificationsRoute(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(routeWaitMs);
  await resetMetrics(page);

  const notificationButton = page.locator('button[aria-label^="Notifications"]');
  if ((await notificationButton.count()) === 0) {
    return {
      available: false,
      reason: "Notifications button not present (likely unauthenticated session).",
      summary: null,
    };
  }

  await notificationButton.first().click();
  await page.waitForTimeout(routeWaitMs);

  const snapshot = await readSnapshot(page);
  return {
    available: true,
    reason: null,
    summary: findRoute(snapshot, (key) => key.endsWith("::notifications")),
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(
    storageStatePath ? { storageState: storageStatePath } : undefined
  );
  const page = await context.newPage();
  const badRequestLogs = [];

  page.on("console", (message) => {
    const text = message.text();
    if (text.includes("[supabase][400]")) {
      badRequestLogs.push(text);
    }
  });

  try {
    const homeSummary = await captureRoute(page, "/");
    const profileMetrics = await captureProfileRoute(page);
    const notificationsMetrics = await captureNotificationsRoute(page);

    const output = {
      baseUrl,
      waitMs: routeWaitMs,
      authStorageStateUsed: Boolean(storageStatePath),
      generatedAt: new Date().toISOString(),
      feed: homeSummary,
      profile: profileMetrics,
      notifications: notificationsMetrics,
      badRequestLogs: Array.from(new Set(badRequestLogs)),
    };

    console.log(JSON.stringify(output, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("[measure-request-metrics] Failed:", error);
  process.exit(1);
});
