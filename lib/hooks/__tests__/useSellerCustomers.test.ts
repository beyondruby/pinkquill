import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc, from: vi.fn(), auth: { getUser: vi.fn() } } }));

import { useSellerCustomers } from "../useSellerCustomers";

describe("useSellerCustomers (Phase 4b: one aggregate RPC)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls get_seller_customers once and coerces the numeric strings the database returns", async () => {
    rpc.mockResolvedValue({
      data: {
        customers: [{ buyer_id: "b1", username: "bea", display_name: null, avatar_url: null, is_verified: false, total_orders: 2, completed_orders: 1, active_orders: 1, total_spent: "45.00", avg_order_value: "22.50", buyer_phone: null, shipping_address: null, first_order_at: "2026-08-01", last_order_at: "2026-09-01", orders: [{ id: "o1", order_number: "PQ-1", status: "completed", amount: "20.00", created_at: "2026-08-01", product_title: "Sketch", listing_type: "service" }] }],
        stats: { total_customers: 1, repeat_customers: 1, total_revenue: "45.00", avg_order_value: "22.50" },
      },
      error: null,
    });
    const { result } = renderHook(() => useSellerCustomers("s1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_seller_customers", { p_seller_id: "s1" });
    expect(result.current.customers[0].total_spent).toBe(45);
    expect(result.current.customers[0].orders[0].amount).toBe(20);
    expect(result.current.stats).toEqual({ total_customers: 1, repeat_customers: 1, total_revenue: 45, avg_order_value: 22.5 });
  });

  it("keeps empty stats and reports the error when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Not authorized" } });
    const { result } = renderHook(() => useSellerCustomers("s1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Not authorized");
    expect(result.current.customers).toEqual([]);
    expect(result.current.stats.total_customers).toBe(0);
  });
});
