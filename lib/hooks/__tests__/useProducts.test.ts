import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDeleteProduct } from "../useProducts";

const { mockDeleteOwnListing } = vi.hoisted(() => ({
  mockDeleteOwnListing: vi.fn(),
}));

vi.mock("@/lib/content-client", () => ({
  deleteOwnListing: mockDeleteOwnListing,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe("useDeleteProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the deleted listing result", async () => {
    mockDeleteOwnListing.mockResolvedValue({
      listingId: "product-1",
      listingType: "product",
      outcome: "deleted",
    });

    const { result } = renderHook(() => useDeleteProduct());

    await act(async () => {
      const success = await result.current.deleteProduct("product-1");
      expect(success).toEqual({
        listingId: "product-1",
        listingType: "product",
        outcome: "deleted",
      });
    });

    expect(mockDeleteOwnListing).toHaveBeenCalledWith("product-1");
    expect(result.current.error).toBeNull();
  });

  it("returns the archived listing result", async () => {
    mockDeleteOwnListing.mockResolvedValue({
      listingId: "product-1",
      listingType: "product",
      outcome: "archived",
    });

    const { result } = renderHook(() => useDeleteProduct());

    await act(async () => {
      const success = await result.current.deleteProduct("product-1");
      expect(success).toEqual({
        listingId: "product-1",
        listingType: "product",
        outcome: "archived",
      });
    });

    expect(mockDeleteOwnListing).toHaveBeenCalledWith("product-1");
    expect(result.current.error).toBeNull();
  });
});
