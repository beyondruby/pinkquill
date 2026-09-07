import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useToggleSave, useToggleRelay, useBlock } from "../useInteractions";

// Mock Supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockMaybeSingle = vi.fn();
const mockChannel = vi.fn();
const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const mockRemoveChannel = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe("useToggleSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      delete: mockDelete,
      insert: mockInsert,
    });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("should unsave when already saved", async () => {
    const { result } = renderHook(() => useToggleSave());

    await act(async () => {
      await result.current.toggle("post-1", "user-1", true);
    });

    expect(mockFrom).toHaveBeenCalledWith("saves");
    expect(mockDelete).toHaveBeenCalled();
  });

  it("should save when not saved", async () => {
    const { result } = renderHook(() => useToggleSave());

    await act(async () => {
      await result.current.toggle("post-1", "user-1", false);
    });

    expect(mockFrom).toHaveBeenCalledWith("saves");
    expect(mockInsert).toHaveBeenCalledWith({
      post_id: "post-1",
      user_id: "user-1",
    });
  });
});

describe("useToggleRelay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      delete: mockDelete,
      insert: mockInsert,
    });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, error: null });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("should remove relay when already relayed", async () => {
    const { result } = renderHook(() => useToggleRelay());

    await act(async () => {
      await result.current.toggle("post-1", "user-1", true);
    });

    expect(mockFrom).toHaveBeenCalledWith("relays");
    expect(mockDelete).toHaveBeenCalled();
  });

  it("should add relay when not relayed", async () => {
    const { result } = renderHook(() => useToggleRelay());

    await act(async () => {
      await result.current.toggle("post-1", "user-1", false);
    });

    expect(mockFrom).toHaveBeenCalledWith("relays");
    expect(mockInsert).toHaveBeenCalledWith({
      post_id: "post-1",
      user_id: "user-1",
    });
  });
});

describe("useBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
    });
  });

  it("should check if user is blocked", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { id: "block-1" }, error: null });

    const { result } = renderHook(() => useBlock());

    await act(async () => {
      const isBlocked = await result.current.checkIsBlocked("blocker-1", "blocked-1");
      expect(isBlocked).toBe(true);
    });
  });

  it("should return false when user is not blocked", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useBlock());

    await act(async () => {
      const isBlocked = await result.current.checkIsBlocked("blocker-1", "blocked-1");
      expect(isBlocked).toBe(false);
    });
  });

  it("should block user and remove follows", async () => {
    mockInsert.mockResolvedValue({ error: null });
    mockEq.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const { result } = renderHook(() => useBlock());

    await act(async () => {
      const response = await result.current.blockUser("blocker-1", "blocked-1");
      expect(response.success).toBe(true);
    });

    expect(mockInsert).toHaveBeenCalledWith({
      blocker_id: "blocker-1",
      blocked_id: "blocked-1",
    });
  });

  it("should unblock user", async () => {
    mockEq.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const { result } = renderHook(() => useBlock());

    await act(async () => {
      const response = await result.current.unblockUser("blocker-1", "blocked-1");
      expect(response.success).toBe(true);
    });
  });

  it("should check blocked either way", async () => {
    // First call returns block, second returns null
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "block-1" }, error: null });

    const { result } = renderHook(() => useBlock());

    await act(async () => {
      const isBlocked = await result.current.checkIsBlockedEitherWay("user-1", "user-2");
      expect(isBlocked).toBe(true);
    });
  });
});
