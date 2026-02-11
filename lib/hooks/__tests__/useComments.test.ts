import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useComments } from "../useComments";

// Define types for the mock
interface MockQueryBuilder {
  [key: string]: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

// Mock Supabase with proper chain
const createMockQueryBuilder = (resolvedData: unknown = [], error: unknown = null): MockQueryBuilder => {
  const mockResult = { data: resolvedData, error };

  const builder: MockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(mockResult),
    single: vi.fn().mockResolvedValue(mockResult),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };

  // Make chainable methods return builder
  (['select', 'eq', 'is', 'order'] as const).forEach(method => {
    builder[method] = vi.fn().mockReturnValue(builder);
  });

  builder.range = vi.fn().mockResolvedValue(mockResult);
  builder.in = vi.fn().mockResolvedValue({ data: [], error: null });

  return builder;
};

let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>;
const { mockCreateNotification } = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => mockQueryBuilder),
  },
}));

// Mock createNotification
vi.mock("../useNotifications", () => ({
  createNotification: mockCreateNotification,
}));

const mockComments = [
  {
    id: "comment-1",
    post_id: "post-1",
    user_id: "user-1",
    content: "Great post!",
    parent_id: null,
    created_at: "2024-01-01T00:00:00Z",
    author: {
      username: "testuser",
      display_name: "Test User",
      avatar_url: null,
    },
  },
  {
    id: "comment-2",
    post_id: "post-1",
    user_id: "user-2",
    content: "I agree!",
    parent_id: null,
    created_at: "2024-01-02T00:00:00Z",
    author: {
      username: "anotheruser",
      display_name: "Another User",
      avatar_url: null,
    },
  },
];

describe("useComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryBuilder = createMockQueryBuilder(mockComments, null);
    mockCreateNotification.mockResolvedValue(true);
  });

  it("should fetch comments on mount", async () => {
    const { result } = renderHook(() => useComments("post-1"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.comments).toHaveLength(2);
    expect(result.current.comments[0].content).toBe("Great post!");
  });

  it("should handle empty comments", async () => {
    mockQueryBuilder = createMockQueryBuilder([], null);

    const { result } = renderHook(() => useComments("post-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.comments).toHaveLength(0);
    expect(result.current.hasMore).toBe(false);
  });

  it("should handle fetch error gracefully", async () => {
    mockQueryBuilder = createMockQueryBuilder(null, { message: "Database error" });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useComments("post-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should add new comment", async () => {
    const newComment = {
      id: "new-comment",
      content: "New comment!",
      created_at: new Date().toISOString(),
      author: { username: "testuser", display_name: "Test", avatar_url: null },
    };

    // Setup insert chain
    mockQueryBuilder.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: newComment, error: null }),
      }),
    });

    const { result } = renderHook(() => useComments("post-1", "user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const response = await result.current.addComment("user-1", "New comment!");
      expect(response.success).toBe(true);
    });
  });

  it("should add reply to comment", async () => {
    const newReply = {
      id: "new-reply",
      content: "This is a reply",
      parent_id: "comment-1",
      created_at: new Date().toISOString(),
      author: { username: "testuser", display_name: "Test", avatar_url: null },
    };

    mockQueryBuilder.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: newReply, error: null }),
      }),
    });

    const { result } = renderHook(() => useComments("post-1", "user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const response = await result.current.addComment("user-1", "This is a reply", "comment-1");
      expect(response.success).toBe(true);
    });
  });

  it("should pass reply comment id as notification comment_id (not community_id)", async () => {
    const newReply = {
      id: "new-reply",
      content: "This is a reply",
      parent_id: "comment-1",
      created_at: new Date().toISOString(),
      author: { username: "testuser", display_name: "Test", avatar_url: null },
    };

    mockQueryBuilder.insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: newReply, error: null }),
      }),
    });
    mockQueryBuilder.single = vi.fn().mockResolvedValue({
      data: { user_id: "parent-user" },
      error: null,
    });

    const { result } = renderHook(() => useComments("post-1", "user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const response = await result.current.addComment("user-1", "This is a reply", "comment-1");
      expect(response.success).toBe(true);
    });

    expect(mockCreateNotification).toHaveBeenCalledWith(
      "parent-user",
      "user-1",
      "reply",
      "post-1",
      "This is a reply",
      undefined,
      "comment-1"
    );
  });

  it("should delete comment", async () => {
    // Setup delete chain to resolve successfully
    mockQueryBuilder.delete = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const { result } = renderHook(() => useComments("post-1", "user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const response = await result.current.deleteComment("comment-1");
      expect(response.success).toBe(true);
    });
  });

  it("should refetch comments", async () => {
    const { result } = renderHook(() => useComments("post-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refetch();
    });

    // Should still have comments after refetch
    expect(result.current.comments).toHaveLength(2);
  });
});
