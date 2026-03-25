import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProfile, useFollow, useFollowList, useFollowRequests } from "../useProfile";

// Define types for the mock chain
interface MockChain {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
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
const createChainableMock = (finalResult: { data: unknown; error: unknown } = { data: null, error: null }): MockChain => {
  const chain = {} as MockChain;
  const methods: (keyof MockChain)[] = ['select', 'eq', 'is', 'order', 'range', 'limit', 'in'];

  methods.forEach(method => {
    chain[method] = vi.fn().mockReturnValue(chain);
  });

  chain.single = vi.fn().mockResolvedValue(finalResult);
  chain.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  chain.insert = vi.fn().mockResolvedValue({ error: null });
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);

  // Make terminal methods resolve
  chain.eq.mockImplementation(() => {
    const newChain = { ...chain };
    newChain.eq = vi.fn().mockReturnValue(newChain);
    newChain.single = vi.fn().mockResolvedValue(finalResult);
    newChain.maybeSingle = vi.fn().mockResolvedValue(finalResult);
    return newChain;
  });

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

// Mock createNotification
vi.mock("../useNotifications", () => ({
  createNotification: vi.fn(),
}));

const mockProfile = {
  id: "user-123",
  username: "testuser",
  display_name: "Test User",
  avatar_url: null,
  cover_url: null,
  bio: "Test bio",
  tagline: "Test tagline",
  role: "Writer",
  education: null,
  location: "NYC",
  languages: null,
  website: "https://example.com",
  is_verified: false,
  is_private: false,
  created_at: "2024-01-01T00:00:00Z",
};

const mockPosts = [
  {
    id: "post-1",
    author_id: "user-123",
    type: "poem",
    title: "Test Poem",
    content: "<p>Test content</p>",
    visibility: "public",
    status: "published",
    created_at: "2024-01-01T00:00:00Z",
    author: {
      username: "testuser",
      display_name: "Test User",
      avatar_url: null,
    },
    media: [],
    community: null,
    admires: [{ count: 5 }],
    comments: [{ count: 3 }],
  },
];

describe("useProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFromImplementation = (table: string) => {
      if (table === "profiles") {
        return createChainableMock({ data: mockProfile, error: null });
      }
      if (table === "blocks") {
        return createChainableMock({ data: null, error: null });
      }
      if (table === "follows") {
        const chain = createChainableMock({ data: null, error: null });
        chain.select = vi.fn().mockReturnValue({
          ...chain,
          count: 0,
        });
        return chain;
      }
      if (table === "posts") {
        const chain = createChainableMock({ data: mockPosts, error: null });
        chain.order = vi.fn().mockReturnValue({
          ...chain,
          in: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
        });
        return chain;
      }
      return createChainableMock();
    };
  });

  it("should fetch profile on mount", async () => {
    const { result } = renderHook(() => useProfile("testuser"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile?.username).toBe("testuser");
    expect(result.current.error).toBeNull();
  });

  it("should return error when user not found", async () => {
    mockFromImplementation = (table: string) => {
      if (table === "profiles") {
        return createChainableMock({ data: null, error: { code: "PGRST116", message: "Not found" } });
      }
      return createChainableMock();
    };

    const { result } = renderHook(() => useProfile("nonexistent"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("User not found");
    expect(result.current.profile).toBeNull();
  });

  it("should detect blocked state", async () => {
    mockFromImplementation = (table: string) => {
      if (table === "profiles") {
        return createChainableMock({ data: mockProfile, error: null });
      }
      if (table === "blocks") {
        return createChainableMock({ data: { id: "block-1" }, error: null });
      }
      return createChainableMock();
    };

    const { result } = renderHook(() => useProfile("testuser", "viewer-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isBlockedByUser).toBe(true);
    expect(result.current.error).toBe("blocked");
  });

  it("should handle private accounts", async () => {
    mockFromImplementation = (table: string) => {
      if (table === "profiles") {
        return createChainableMock({ data: { ...mockProfile, is_private: true }, error: null });
      }
      if (table === "blocks") {
        return createChainableMock({ data: null, error: null });
      }
      if (table === "follows") {
        const chain = createChainableMock({ data: null, error: null });
        chain.select = vi.fn().mockReturnValue({
          ...chain,
          count: 0,
        });
        return chain;
      }
      return createChainableMock();
    };

    const { result } = renderHook(() => useProfile("testuser", "viewer-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isPrivateAccount).toBe(true);
    expect(result.current.posts).toHaveLength(0);
  });
});

describe("useFollow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFromImplementation = (table: string) => {
      const chain = createChainableMock({ data: null, error: null });
      if (table === "profiles") {
        chain.single = vi.fn().mockResolvedValue({ data: { is_private: false }, error: null });
      }
      return chain;
    };
  });

  it("should check follow status", async () => {
    mockFromImplementation = () => createChainableMock({ data: { status: "accepted" }, error: null });

    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const status = await result.current.checkFollowStatus("follower-1", "following-1");
      expect(status).toBe("accepted");
    });
  });

  it("should return null when not following", async () => {
    mockFromImplementation = () => createChainableMock({ data: null, error: null });

    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const status = await result.current.checkFollowStatus("follower-1", "following-1");
      expect(status).toBeNull();
    });
  });

  it("should follow user", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    mockFromImplementation = (table: string) => {
      const chain = createChainableMock({ data: { is_private: false }, error: null });
      chain.insert = insertMock;
      return chain;
    };

    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const status = await result.current.follow("follower-1", "following-1");
      expect(status).toBe("accepted");
    });

    expect(insertMock).toHaveBeenCalled();
  });

  it("should unfollow user", async () => {
    mockFromImplementation = () => createChainableMock({ data: null, error: null });

    const { result } = renderHook(() => useFollow());

    await act(async () => {
      await result.current.unfollow("follower-1", "following-1");
      // unfollow returns void, just check it doesn't throw
    });
  });

  it("should check if user is private", async () => {
    mockFromImplementation = () => createChainableMock({ data: { is_private: true }, error: null });

    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const isPrivate = await result.current.checkIsPrivate("user-1");
      expect(isPrivate).toBe(true);
    });
  });
});

describe("useFollowList", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFromImplementation = () => {
      const chain = createChainableMock();
      chain.eq = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              follower: {
                id: "follower-1",
                username: "follower1",
                display_name: "Follower One",
                avatar_url: null,
                is_verified: false,
              },
            },
            {
              follower: {
                id: "follower-2",
                username: "follower2",
                display_name: "Follower Two",
                avatar_url: null,
                is_verified: true,
              },
            },
          ],
          error: null,
        }),
      });
      return chain;
    };
  });

  it("should fetch followers list", async () => {
    const { result } = renderHook(() => useFollowList("user-1", "followers"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.users).toHaveLength(2);
  });

  it("should fetch following list", async () => {
    mockFromImplementation = () => {
      const chain = createChainableMock();
      chain.eq = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              following: {
                id: "following-1",
                username: "following1",
                display_name: "Following One",
                avatar_url: null,
                is_verified: false,
              },
            },
          ],
          error: null,
        }),
      });
      return chain;
    };

    const { result } = renderHook(() => useFollowList("user-1", "following"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.users).toHaveLength(1);
  });
});

describe("useFollowRequests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFromImplementation = () => createChainableMock();

    mockChannel.mockReturnValue({ on: mockOn });
    mockOn.mockReturnValue({ subscribe: mockSubscribe });
    mockSubscribe.mockReturnValue({});
  });

  it("should not fetch when no userId", async () => {
    const { result } = renderHook(() => useFollowRequests(undefined));

    expect(result.current.loading).toBe(false);
    expect(result.current.requests).toHaveLength(0);
    expect(result.current.count).toBe(0);
  });

  it("should have accept and decline methods", async () => {
    const { result } = renderHook(() => useFollowRequests(undefined));

    // Just verify the methods exist
    expect(typeof result.current.accept).toBe("function");
    expect(typeof result.current.decline).toBe("function");
    expect(typeof result.current.refetch).toBe("function");
  });
});
