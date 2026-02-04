import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFeed, useSavedPosts, useRelays } from "../useFeed";

// Mock Supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
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

const mockPosts = [
  {
    id: "post-1",
    author_id: "author-1",
    type: "poem",
    title: "Test Poem",
    content: "<p>Test content</p>",
    visibility: "public",
    status: "published",
    created_at: "2024-01-01T00:00:00Z",
    author: {
      id: "author-1",
      username: "testuser",
      display_name: "Test User",
      avatar_url: null,
      is_verified: false,
      is_private: false,
    },
    media: [],
    community: null,
    admires: [{ count: 5 }],
    comments: [{ count: 3 }],
    relays: [{ count: 2 }],
  },
  {
    id: "post-2",
    author_id: "author-2",
    type: "thought",
    title: null,
    content: "<p>Another post</p>",
    visibility: "public",
    status: "published",
    created_at: "2024-01-02T00:00:00Z",
    author: {
      id: "author-2",
      username: "anotheruser",
      display_name: "Another User",
      avatar_url: null,
      is_verified: true,
      is_private: false,
    },
    media: [],
    community: null,
    admires: [{ count: 10 }],
    comments: [{ count: 7 }],
    relays: [{ count: 1 }],
  },
];

describe("useFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock chain for posts query
    mockFrom.mockReturnValue({
      select: mockSelect,
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
      in: mockIn,
    });

    mockEq.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      in: mockIn,
    });

    mockOrder.mockReturnValue({
      range: mockRange,
    });

    mockRange.mockResolvedValue({
      data: mockPosts,
      error: null,
      count: 2,
    });

    // Mock auxiliary queries (collaborators, mentions, tags, user interactions)
    mockIn.mockResolvedValue({
      data: [],
      error: null,
    });

    // Setup realtime mock
    mockChannel.mockReturnValue({
      on: mockOn,
    });
    mockOn.mockReturnValue({
      on: mockOn,
      subscribe: mockSubscribe,
    });
    mockSubscribe.mockReturnValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch posts on mount", async () => {
    const { result } = renderHook(() => useFeed());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("should fetch posts with correct query structure", async () => {
    renderHook(() => useFeed());

    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith("posts");
      expect(mockEq).toHaveBeenCalledWith("status", "published");
    });
  });

  it("should filter by community when communityId provided", async () => {
    renderHook(() => useFeed(undefined, { communityId: "community-1" }));

    await waitFor(() => {
      expect(mockEq).toHaveBeenCalledWith("community_id", "community-1");
    });
  });

  it("should handle pagination", async () => {
    const { result } = renderHook(() => useFeed(undefined, { pageSize: 10 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pagination.page).toBe(0);
    expect(result.current.pagination.pageSize).toBe(10);
  });

  it("should load more posts", async () => {
    mockRange
      .mockResolvedValueOnce({
        data: mockPosts,
        error: null,
        count: 50, // Total count indicates more posts
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "post-3",
            author_id: "author-3",
            type: "journal",
            content: "<p>Third post</p>",
            visibility: "public",
            status: "published",
            created_at: "2024-01-03T00:00:00Z",
            author: {
              id: "author-3",
              username: "thirduser",
              display_name: "Third User",
              avatar_url: null,
              is_verified: false,
              is_private: false,
            },
            media: [],
            community: null,
            admires: [{ count: 0 }],
            comments: [{ count: 0 }],
            relays: [{ count: 0 }],
          },
        ],
        error: null,
        count: 50,
      });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.loadMore();
    });

    // Should append posts
    expect(result.current.posts.length).toBeGreaterThanOrEqual(2);
  });

  it("should refresh posts", async () => {
    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockRange.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockRange).toHaveBeenCalled();
  });

  it("should handle fetch error", async () => {
    mockRange.mockResolvedValue({
      data: null,
      error: { message: "Database error", code: "500" },
      count: null,
    });

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.posts).toHaveLength(0);
  });

  it("should fetch user interactions when userId provided", async () => {
    renderHook(() => useFeed("user-1"));

    await waitFor(() => {
      // Should fetch admires, saves, relays, reactions for user
      expect(mockIn).toHaveBeenCalled();
    });
  });

  it("should setup realtime subscription", async () => {
    renderHook(() => useFeed("user-1"));

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalled();
    });
  });

  it("should transform posts with correct counts", async () => {
    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const firstPost = result.current.posts[0];
    expect(firstPost.admires_count).toBe(5);
    expect(firstPost.comments_count).toBe(3);
    expect(firstPost.relays_count).toBe(2);
  });

  it("should cleanup on unmount", async () => {
    const { unmount } = renderHook(() => useFeed("user-1"));

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalled();
    });

    unmount();

    expect(mockRemoveChannel).toHaveBeenCalled();
  });
});

describe("useSavedPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue({
      select: mockSelect,
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
      in: mockIn,
    });

    mockEq.mockReturnValue({
      order: mockOrder,
    });

    mockOrder.mockResolvedValue({
      data: [
        {
          post: {
            id: "saved-post-1",
            title: "Saved Post",
            type: "poem",
            content: "<p>Saved content</p>",
            author: { username: "author", display_name: "Author", avatar_url: null },
            media: [],
            admires: [{ count: 5 }],
            comments: [{ count: 2 }],
          },
        },
      ],
      error: null,
    });
  });

  it("should fetch saved posts for user", async () => {
    const { result } = renderHook(() => useSavedPosts("user-1"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFrom).toHaveBeenCalledWith("saves");
    expect(result.current.posts).toHaveLength(1);
  });

  it("should not fetch when no userId", async () => {
    const { result } = renderHook(() => useSavedPosts(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(0);
  });
});

describe("useRelays", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "user-123", username: "testuser" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "relays") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    created_at: "2024-01-01T00:00:00Z",
                    post: {
                      id: "relayed-post-1",
                      title: "Relayed Post",
                      type: "thought",
                      content: "<p>Relayed content</p>",
                      author: { username: "original", display_name: "Original", avatar_url: null },
                      media: [],
                      admires: [{ count: 10 }],
                      comments: [{ count: 5 }],
                    },
                  },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: mockSelect };
    });
  });

  it("should fetch relayed posts for username", async () => {
    const { result } = renderHook(() => useRelays("testuser"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.relays).toHaveLength(1);
  });
});
