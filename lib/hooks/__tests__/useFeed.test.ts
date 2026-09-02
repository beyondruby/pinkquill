import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFeed, useSavedPosts, useRelays } from "../useFeed";

// Define types for the mock
interface MockQueryBuilder {
  [key: string]: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  abortSignal: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

// Mock Supabase with proper chain
const createMockQueryBuilder = (resolvedData: unknown = [], error: unknown = null, count: number | null = null): MockQueryBuilder => {
  const mockResult = { data: resolvedData, error, count };
  const createTerminal = () => Object.assign(Promise.resolve(mockResult), {
    abortSignal: vi.fn().mockResolvedValue(mockResult),
  });

  const builder: MockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockImplementation(createTerminal),
    abortSignal: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockResult),
    maybeSingle: vi.fn().mockResolvedValue(mockResult),
  };

  // Make all methods chainable
  (Object.keys(builder) as Array<keyof MockQueryBuilder>).forEach(key => {
    if (key !== 'range' && key !== 'single' && key !== 'maybeSingle') {
      builder[key] = vi.fn().mockReturnValue(builder);
    }
  });

  // Override range to resolve
  builder.range = vi.fn().mockImplementation(createTerminal);

  return builder;
};

const mockChannel = vi.fn();
const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const mockRemoveChannel = vi.fn();

let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>;

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => mockQueryBuilder),
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

    // Create fresh mock query builder with posts data
    mockQueryBuilder = createMockQueryBuilder(mockPosts, null, 2);

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

  it("should handle pagination state", async () => {
    const { result } = renderHook(() => useFeed(undefined, { pageSize: 10 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.pagination.page).toBe(0);
    expect(result.current.pagination.pageSize).toBe(10);
  });

  it("should handle fetch error", async () => {
    mockQueryBuilder = createMockQueryBuilder(null, { message: "Database error", code: "500" }, null);

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.posts).toHaveLength(0);
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

  it("should not open a realtime channel (feed counts refresh on focus, not via postgres_changes)", async () => {
    const { result, unmount } = renderHook(() => useFeed("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockChannel).not.toHaveBeenCalled();

    unmount();

    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });

  it("should refresh posts", async () => {
    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    // Refresh should have fetched posts again
    expect(result.current.posts).toHaveLength(2);
  });

  it("should handle empty posts", async () => {
    mockQueryBuilder = createMockQueryBuilder([], null, 0);

    const { result } = renderHook(() => useFeed());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(0);
    expect(result.current.pagination.hasMore).toBe(false);
  });
});

describe("useSavedPosts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryBuilder = createMockQueryBuilder([], null, 0);
  });

  it("should not fetch when no userId", async () => {
    const { result } = renderHook(() => useSavedPosts(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(0);
  });

  it("should have loading and posts state", () => {
    const { result } = renderHook(() => useSavedPosts(undefined));
    expect(typeof result.current.loading).toBe("boolean");
    expect(Array.isArray(result.current.posts)).toBe(true);
  });
});

describe("useRelays", () => {
  it("should have loading state", () => {
    const { result } = renderHook(() => useRelays(""));
    // Just verify hook initializes without error
    expect(typeof result.current.loading).toBe("boolean");
    expect(Array.isArray(result.current.relays)).toBe(true);
  });
});
