import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useToggleAdmire,
  useToggleSave,
  useToggleRelay,
  useToggleReaction,
  useReactionCounts,
  useUserReaction,
  useBlock,
} from "../useInteractions";

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

describe("useToggleAdmire", () => {
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

  it("should remove admire when already admired", async () => {
    const { result } = renderHook(() => useToggleAdmire());

    await act(async () => {
      await result.current.toggle("post-1", "user-1", true);
    });

    expect(mockFrom).toHaveBeenCalledWith("admires");
    expect(mockDelete).toHaveBeenCalled();
  });

  it("should add admire when not admired", async () => {
    const { result } = renderHook(() => useToggleAdmire());

    await act(async () => {
      await result.current.toggle("post-1", "user-1", false);
    });

    expect(mockFrom).toHaveBeenCalledWith("admires");
    expect(mockInsert).toHaveBeenCalledWith({
      post_id: "post-1",
      user_id: "user-1",
    });
  });

  it("should throw error when delete fails", async () => {
    mockEq.mockReturnValue({ eq: vi.fn().mockReturnValue({ error: { message: "Delete failed" } }) });

    const { result } = renderHook(() => useToggleAdmire());

    await expect(result.current.toggle("post-1", "user-1", true)).rejects.toThrow();
  });
});

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

describe("useToggleReaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      delete: mockDelete,
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
    });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({
      eq: vi.fn().mockReturnValue({ error: null, data: null }),
      maybeSingle: mockMaybeSingle,
    });
    mockInsert.mockResolvedValue({ error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("should remove reaction when same reaction clicked", async () => {
    mockEq.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const { result } = renderHook(() => useToggleReaction());

    await act(async () => {
      const response = await result.current.react("post-1", "user-1", "admire", "admire");
      expect(response.success).toBe(true);
      expect(response.removed).toBe(true);
    });
  });

  it("should update reaction when different reaction clicked", async () => {
    mockEq.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const { result } = renderHook(() => useToggleReaction());

    await act(async () => {
      const response = await result.current.react("post-1", "user-1", "snap", "admire");
      expect(response.success).toBe(true);
      expect(response.changed).toBe(true);
    });
  });

  it("should insert new reaction when no current reaction", async () => {
    const { result } = renderHook(() => useToggleReaction());

    await act(async () => {
      const response = await result.current.react("post-1", "user-1", "admire", null);
      expect(response.success).toBe(true);
      expect(response.added).toBe(true);
    });

    expect(mockInsert).toHaveBeenCalledWith({
      post_id: "post-1",
      user_id: "user-1",
      reaction_type: "admire",
    });
  });

  it("should get current reaction for user", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { reaction_type: "snap" }, error: null });
    mockEq.mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) });

    const { result } = renderHook(() => useToggleReaction());

    await act(async () => {
      const reaction = await result.current.getReaction("post-1", "user-1");
      expect(reaction).toBe("snap");
    });
  });
});

describe("useReactionCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: [
        {
          admire_count: 5,
          snap_count: 3,
          ovation_count: 2,
          support_count: 1,
          inspired_count: 0,
          applaud_count: 4,
          total_count: 15,
        },
      ],
      error: null,
    });
    mockChannel.mockReturnValue({
      on: mockOn,
    });
    mockOn.mockReturnValue({
      subscribe: mockSubscribe,
    });
    mockSubscribe.mockReturnValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch reaction counts on mount", async () => {
    const { result } = renderHook(() => useReactionCounts("post-1"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.counts.admire).toBe(5);
    expect(result.current.counts.snap).toBe(3);
    expect(result.current.counts.total).toBe(15);
  });

  it("should skip realtime subscription when disabled", async () => {
    renderHook(() => useReactionCounts("post-1", { disableRealtime: true }));

    await waitFor(() => {
      expect(mockChannel).not.toHaveBeenCalled();
    });
  });
});

describe("useUserReaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      }),
    });
    mockMaybeSingle.mockResolvedValue({ data: { reaction_type: "admire" }, error: null });
    mockChannel.mockReturnValue({
      on: mockOn,
    });
    mockOn.mockReturnValue({
      subscribe: mockSubscribe,
    });
    mockSubscribe.mockReturnValue({});
  });

  it("should fetch user reaction on mount", async () => {
    const { result } = renderHook(() => useUserReaction("post-1", "user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.reaction).toBe("admire");
  });

  it("should return null when no userId provided", async () => {
    const { result } = renderHook(() => useUserReaction("post-1", undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.reaction).toBe(null);
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
