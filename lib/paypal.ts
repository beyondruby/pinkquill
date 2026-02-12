/**
 * PayPal Server Client — Lazy Initialization
 *
 * Uses the PayPal REST API v2 directly via fetch.
 * Lazy init via Proxy pattern (same as stripe.ts) to avoid
 * build-time crashes when env vars are missing.
 *
 * Required env vars:
 *   PAYPAL_CLIENT_ID
 *   PAYPAL_CLIENT_SECRET
 *   PAYPAL_ENVIRONMENT=sandbox|production
 */

export type PayPalEnvironment = "sandbox" | "production";

function getEnvironment(): PayPalEnvironment {
  const env = process.env.PAYPAL_ENVIRONMENT?.toLowerCase();
  return env === "production" ? "production" : "sandbox";
}

function getBaseUrl(): string {
  return getEnvironment() === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

let _accessToken: string | null = null;
let _tokenExpiresAt = 0;

/**
 * Get an OAuth2 access token from PayPal (client credentials flow).
 * Caches the token until near expiry.
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (_accessToken && now < _tokenExpiresAt - 60_000) {
    return _accessToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET");
  }

  const res = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PayPal auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  _accessToken = data.access_token;
  _tokenExpiresAt = now + (data.expires_in ?? 32400) * 1000;
  return _accessToken!;
}

/**
 * Make an authenticated request to the PayPal REST API.
 */
export async function paypalFetch<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    idempotencyKey?: string;
  } = {}
): Promise<T> {
  const token = await getAccessToken();
  const { method = "GET", body, headers = {}, idempotencyKey } = options;

  const reqHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...headers,
  };

  if (idempotencyKey) {
    reqHeaders["PayPal-Request-Id"] = idempotencyKey;
  }

  const res = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content
  if (res.status === 204) return {} as T;

  const data = await res.json();

  if (!res.ok) {
    const message = data?.message || data?.error_description || "PayPal request failed";
    const details = Array.isArray(data?.details)
      ? data.details
          .map((detail: { issue?: string; description?: string }) =>
            [detail.issue, detail.description].filter(Boolean).join(": ")
          )
          .filter(Boolean)
          .join(" | ")
      : "";
    const debugId = data?.debug_id ? ` [debug_id=${data.debug_id}]` : "";
    throw new Error(`PayPal API error (${res.status}): ${message}${details ? ` — ${details}` : ""}${debugId}`);
  }

  return data as T;
}

// Convenience helpers
export const paypal = {
  getBaseUrl,
  getEnvironment,
  getAccessToken,
  fetch: paypalFetch,
};
