import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

/**
 * useOrderList (Phase 4a/4b): one server-filtered list for both roles,
 * paging by fetching one row past the page instead of an exact count.
 */

const { chain, calls } = vi.hoisted(() => {
  const calls: Array<[string, unknown[]]> = [];
  let rows: unknown[] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "gte", "lte", "lt", "or", "ilike", "limit"]) {
    chain[m] = vi.fn((...args: unknown[]) => { calls.push([m, args]); return chain; });
  }
  chain.range = vi.fn((...args: unknown[]) => { calls.push(["range", args]); return Promise.resolve({ data: rows, error: null }); });
  (chain as { __setRows: (r: unknown[]) => void }).__setRows = (r) => { rows = r; };
  return { chain, calls };
});

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn(() => chain), rpc: vi.fn(), auth: { getUser: vi.fn(), getSession: vi.fn() } } }));
vi.mock("@/components/providers/UserEventsProvider", () => ({ useUserEvent: vi.fn() }));

import { useOrderList } from "../useOrders";

const row = (i: number) => ({ id: `o${i}`, order_number: `PQ-${i}`, status: "paid", buyer_id: "b", seller_id: "s", amount: 5, product: null, pricing: null, buyer: null, seller: null });

describe("useOrderList", () => {
  beforeEach(() => { calls.length = 0; vi.clearAllMocks(); });

  it("fetches one row past the page and reports hasMore without a count query", async () => {
    (chain as { __setRows: (r: unknown[]) => void }).__setRows([row(1), row(2), row(3)]);
    const { result } = renderHook(() => useOrderList({ role: "buyer", userId: "b", pageSize: 2 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orders.map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(result.current.hasMore).toBe(true);
    const select = calls.find(([m]) => m === "select");
    expect(select?.[1][1]).toBeUndefined(); // no { count: "exact" }
    expect(calls.find(([m]) => m === "range")?.[1]).toEqual([0, 2]); // pageSize + 1 rows
    expect(calls.find(([m]) => m === "eq")?.[1]).toEqual(["buyer_id", "b"]);
  });

  it("filters by the seller column, a status list and a due-before cutoff, sorted by due date", async () => {
    (chain as { __setRows: (r: unknown[]) => void }).__setRows([row(1)]);
    const { result } = renderHook(() => useOrderList({ role: "seller", userId: "s", filters: { status: ["paid", "in_progress"], due_before: "2026-09-10", sort: "due" } as never, pageSize: 20 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMore).toBe(false);
    expect(calls.find(([m]) => m === "eq")?.[1]).toEqual(["seller_id", "s"]);
    expect(calls.find(([m]) => m === "in")?.[1]).toEqual(["status", ["paid", "in_progress"]]);
    expect(calls.find(([m]) => m === "lt")?.[1]).toEqual(["due_date", "2026-09-10"]);
    expect(calls.find(([m]) => m === "order")?.[1][0]).toBe("due_date");
  });

  it("returns nothing and stops loading without a user", async () => {
    const { result } = renderHook(() => useOrderList({ role: "buyer", userId: undefined }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orders).toEqual([]);
    expect(calls.length).toBe(0);
  });
});
