// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-client", () => ({
  buildAuthenticatedHeaders: vi.fn(async (initial?: HeadersInit) => {
    const h = new Headers(initial);
    h.set("Authorization", "Bearer test-token");
    return h;
  }),
}));

import { apiFetch } from "@/lib/api-client";

function mockFetch(status: number, body: string, contentType = "application/json") {
  const fn = vi.fn(async () => new Response(body, { status, headers: { "content-type": contentType } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("apiFetch (the one way to call our API routes)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends JSON with the bearer and returns the parsed body", async () => {
    const fetchMock = mockFetch(200, JSON.stringify({ order_id: "abc" }));
    const r = await apiFetch<{ order_id: string }>("/api/orders/create", { json: { a: 1 } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.order_id).toBe("abc");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer test-token");
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("surfaces the route's error message and status", async () => {
    mockFetch(403, JSON.stringify({ error: "Forbidden" }));
    const r = await apiFetch("/api/admin/settings", { json: {} });
    expect(r).toEqual({ ok: false, error: "Forbidden", status: 403 });
  });

  it("turns an HTML error page into a readable message instead of throwing", async () => {
    mockFetch(502, "<html>Bad gateway</html>", "text/html");
    const r = await apiFetch("/api/payments/refund", { json: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(502); expect(r.error).toMatch(/HTML instead of JSON/); }
  });

  it("reports a connection failure without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const r = await apiFetch("/api/admin/health");
    expect(r).toEqual({ ok: false, error: "Connection failed", status: 0 });
  });
});
