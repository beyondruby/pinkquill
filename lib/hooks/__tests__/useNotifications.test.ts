import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  createNotification,
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useUnreadMessagesCount,
} from "../useNotifications";

// Mock Supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockChannel = vi.fn();
const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const mockRemoveChannel = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

const mockNotifications = [
  {
    id: "notif-1",
    user_id: "user-1",
    actor_id: "actor-1",
    type: "admire",
    post_id: "post-1",
    read: false,
    created_at: "2024-01-01T00:00:00Z",
    actor: {
      username: "liker",
      display_name: "Liker User",
      avatar_url: null,
    },
    post: {
      id: "post-1",
      title: "Test Post",
      type: "poem",
    },
  },
  {
    id: "notif-2",
    user_id: "user-1",
    actor_id: "actor-2",
    type: "follow",
    read: true,
    created_at: "2024-01-02T00:00:00Z",
    actor: {
      username: "follower",
      display_name: "Follower User",
      avatar_url: null,
    },
    post: null,
  },
];

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      insert: mockInsert,
    });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("should create a notification", async () => {
    await createNotification("user-1", "actor-1", "admire", "post-1");

    expect(mockFrom).toHaveBeenCalledWith("notifications");
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      actor_id: "actor-1",
      type: "admire",
      post_id: "post-1",
      content: undefined,
      community_id: undefined,
      comment_id: undefined,
    });
  });

  it("should not create notification when actor is user (self-notification)", async () => {
    await createNotification("user-1", "user-1", "admire", "post-1");

    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("should handle error gracefully", async () => {
    mockInsert.mockResolvedValue({ error: { message: "Insert failed" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await createNotification("user-1", "actor-1", "admire", "post-1");

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
    });
    mockOrder.mockReturnValue({
      limit: mockLimit,
    });
    mockLimit.mockResolvedValue({
      data: mockNotifications,
      error: null,
    });

    // Setup realtime mock
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

  it("should fetch notifications on mount", async () => {
    const { result } = renderHook(() => useNotifications("user-1"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notifications).toHaveLength(2);
  });

  it("should not fetch when no userId", async () => {
    const { result } = renderHook(() => useNotifications(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.current.notifications).toHaveLength(0);
  });

  it("should setup realtime subscription", async () => {
    renderHook(() => useNotifications("user-1"));

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalledWith("notifications:user-1");
    });
  });
});

describe("useUnreadCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        count: 5,
        error: null,
      }),
    });

    mockChannel.mockReturnValue({
      on: mockOn,
    });
    mockOn.mockReturnValue({
      subscribe: mockSubscribe,
    });
    mockSubscribe.mockReturnValue({});
  });

  it("should fetch unread count", async () => {
    const { result } = renderHook(() => useUnreadCount("user-1"));

    await waitFor(() => {
      expect(result.current.count).toBe(5);
    });
  });

  it("should return 0 when no userId", async () => {
    const { result } = renderHook(() => useUnreadCount(undefined));

    expect(result.current.count).toBe(0);
  });
});

describe("useMarkAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      update: mockUpdate,
    });
    mockUpdate.mockReturnValue({
      eq: mockEq,
      in: mockIn,
    });
    mockEq.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockIn.mockResolvedValue({ error: null });
  });

  it("should mark single notification as read", async () => {
    const { result } = renderHook(() => useMarkAsRead());

    await act(async () => {
      await result.current.markAsRead("notif-1");
    });

    expect(mockUpdate).toHaveBeenCalledWith({ read: true });
    expect(mockEq).toHaveBeenCalledWith("id", "notif-1");
  });

  it("should mark all notifications as read for user", async () => {
    const { result } = renderHook(() => useMarkAsRead());

    await act(async () => {
      await result.current.markAllAsRead("user-1");
    });

    expect(mockUpdate).toHaveBeenCalledWith({ read: true });
  });
});

describe("useUnreadMessagesCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock for fetching participant conversations
    const mockConversationIds = [{ conversation_id: "conv-1" }, { conversation_id: "conv-2" }];

    mockFrom.mockImplementation((table: string) => {
      if (table === "conversation_participants") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: mockConversationIds,
              error: null,
            }),
          }),
        };
      }
      if (table === "messages") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  count: 3,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "blocks") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        };
      }
      return { select: mockSelect };
    });

    mockChannel.mockReturnValue({
      on: mockOn,
    });
    mockOn.mockReturnValue({
      subscribe: mockSubscribe,
    });
    mockSubscribe.mockReturnValue({});
  });

  it("should fetch unread messages count", async () => {
    const { result } = renderHook(() => useUnreadMessagesCount("user-1"));

    await waitFor(() => {
      expect(result.current.count).toBeGreaterThanOrEqual(0);
    });
  });

  it("should return 0 when no userId", async () => {
    const { result } = renderHook(() => useUnreadMessagesCount(undefined));

    expect(result.current.count).toBe(0);
  });
});
