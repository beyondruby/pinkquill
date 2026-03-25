import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  createNotification,
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useUnreadMessagesCount,
} from "../useNotifications";

// Define types for the mock chain
interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

// Create chainable mock factory
const createChainableMock = (finalResult: { data: unknown; error: unknown; count?: number } = { data: null, error: null }): MockChain => {
  const chain = {} as MockChain;
  const methods: (keyof MockChain)[] = ['select', 'eq', 'neq', 'is', 'order', 'range', 'limit', 'in'];

  methods.forEach(method => {
    chain[method] = vi.fn().mockReturnValue(chain);
  });

  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  chain.insert = vi.fn().mockResolvedValue({ error: null });
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);

  // Make terminal methods resolve with count
  if (finalResult.count !== undefined) {
    chain.eq.mockImplementation(() => ({
      ...chain,
      eq: vi.fn().mockResolvedValue(finalResult),
    }));
  }

  return chain;
};

// Mock variables
let mockFromImplementation: (table: string) => MockChain;
const mockChannel = vi.fn();
const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const mockRemoveChannel = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => mockFromImplementation(table),
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
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    mockFromImplementation = () => {
      const chain = createChainableMock();
      chain.insert = insertMock;
      return chain;
    };
  });

  it("should not create notification when actor is user (self-notification)", async () => {
    const insertMock = vi.fn();
    mockFromImplementation = () => {
      const chain = createChainableMock();
      chain.insert = insertMock;
      return chain;
    };

    await createNotification("user-1", "user-1", "admire", "post-1");

    expect(insertMock).not.toHaveBeenCalled();
  });

  it("should create a notification for different user", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    mockFromImplementation = () => {
      const chain = createChainableMock();
      chain.insert = insertMock;
      return chain;
    };

    await createNotification("user-1", "actor-1", "admire", "post-1");

    expect(insertMock).toHaveBeenCalled();
  });
});

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFromImplementation = () => createChainableMock({ data: [], error: null });

    mockChannel.mockReturnValue({ on: mockOn });
    mockOn.mockReturnValue({ subscribe: mockSubscribe });
    mockSubscribe.mockReturnValue({});
  });

  it("should not fetch when no userId", () => {
    const { result } = renderHook(() => useNotifications(undefined));
    expect(result.current.notifications).toHaveLength(0);
  });

  it("should have correct return shape", () => {
    // Test without userId to avoid async operations
    const { result } = renderHook(() => useNotifications(undefined));
    expect(typeof result.current.loading).toBe("boolean");
    expect(Array.isArray(result.current.notifications)).toBe(true);
    expect(typeof result.current.refetch).toBe("function");
  });
});

describe("useUnreadCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFromImplementation = () => {
      const chain = createChainableMock({ data: null, count: 5, error: null });
      return chain;
    };

    mockChannel.mockReturnValue({ on: mockOn });
    mockOn.mockReturnValue({ subscribe: mockSubscribe });
    mockSubscribe.mockReturnValue({});
  });

  it("should return 0 when no userId", async () => {
    const { result } = renderHook(() => useUnreadCount(undefined));
    expect(result.current.count).toBe(0);
  });

  it("should have refetch method", () => {
    const { result } = renderHook(() => useUnreadCount(undefined));
    expect(typeof result.current.refetch).toBe("function");
  });
});

describe("useMarkAsRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFromImplementation = () => createChainableMock({ data: null, error: null });
  });

  it("should have markAsRead method", () => {
    const { result } = renderHook(() => useMarkAsRead());
    expect(typeof result.current.markAsRead).toBe("function");
  });

  it("should have markAllAsRead method", () => {
    const { result } = renderHook(() => useMarkAsRead());
    expect(typeof result.current.markAllAsRead).toBe("function");
  });

  it("should mark single notification as read", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFromImplementation = () => {
      const chain = createChainableMock({ data: null, error: null });
      chain.update = updateMock;
      return chain;
    };

    const { result } = renderHook(() => useMarkAsRead());

    await act(async () => {
      await result.current.markAsRead("notif-1");
    });

    expect(updateMock).toHaveBeenCalledWith({ read: true });
  });
});

describe("useUnreadMessagesCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromImplementation = () => createChainableMock({ data: [], count: 0, error: null });
    mockChannel.mockReturnValue({ on: mockOn });
    mockOn.mockReturnValue({ subscribe: mockSubscribe });
    mockSubscribe.mockReturnValue({});
  });

  it("should return 0 when no userId", () => {
    const { result } = renderHook(() => useUnreadMessagesCount(undefined));
    expect(result.current.count).toBe(0);
  });

  it("should have correct return shape", () => {
    // Test without userId to avoid async operations
    const { result } = renderHook(() => useUnreadMessagesCount(undefined));
    expect(typeof result.current.count).toBe("number");
    expect(typeof result.current.refetch).toBe("function");
  });
});
