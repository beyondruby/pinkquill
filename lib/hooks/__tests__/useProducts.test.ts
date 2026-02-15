import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDeleteProduct } from "../useProducts";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function createProductsTableMock() {
  const deleteTerminal = vi.fn();
  const deleteEqSecond = vi.fn().mockReturnValue({ eq: deleteTerminal });
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqSecond });

  const updateTerminal = vi.fn();
  const updateEqSecond = vi.fn().mockReturnValue({ eq: updateTerminal });
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqSecond });

  return {
    deleteMock,
    deleteEqSecond,
    deleteTerminal,
    updateMock,
    updateEqSecond,
    updateTerminal,
    table: {
      delete: deleteMock,
      update: updateMock,
    },
  };
}

describe("useDeleteProduct", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "seller-1" } } });
  });

  it("deletes listing when no foreign key constraints block deletion", async () => {
    const mock = createProductsTableMock();
    mock.deleteTerminal.mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") return mock.table;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() => useDeleteProduct());

    await act(async () => {
      const success = await result.current.deleteProduct("product-1");
      expect(success).toBe(true);
    });

    expect(mock.deleteMock).toHaveBeenCalledTimes(1);
    expect(mock.updateMock).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("falls back to archive when hard delete is blocked by existing orders", async () => {
    const mock = createProductsTableMock();
    mock.deleteTerminal.mockResolvedValue({
      error: { code: "23503", message: "foreign key violation" },
    });
    mock.updateTerminal.mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "products") return mock.table;
      throw new Error(`Unexpected table: ${table}`);
    });

    const { result } = renderHook(() => useDeleteProduct());

    await act(async () => {
      const success = await result.current.deleteProduct("product-1");
      expect(success).toBe(true);
    });

    expect(mock.deleteMock).toHaveBeenCalledTimes(1);
    expect(mock.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "archived",
      })
    );
    expect(result.current.error).toBeNull();
  });
});
