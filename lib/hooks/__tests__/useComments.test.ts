import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useComments } from "../useComments";

// Mock Supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock createNotification
vi.mock("../useNotifications", () => ({
  createNotification: vi.fn(),
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

    // Setup chain for comments query
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
      in: mockIn,
    });

    mockEq.mockReturnValue({
      is: mockIs,
      eq: mockEq,
      single: mockSingle,
    });

    mockIs.mockReturnValue({
      order: mockOrder,
    });

    mockOrder.mockReturnValue({
      range: mockRange,
    });

    mockRange.mockResolvedValue({
      data: mockComments,
      error: null,
    });

    // Mock likes and replies counts
    mockIn.mockResolvedValue({
      data: [],
      error: null,
    });

    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    });

    mockSingle.mockResolvedValue({
      data: {
        id: "new-comment",
        content: "New comment",
        created_at: new Date().toISOString(),
        author: { username: "testuser", display_name: "Test", avatar_url: null },
      },
      error: null,
    });
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

  it("should only fetch top-level comments initially", async () => {
    renderHook(() => useComments("post-1"));

    await waitFor(() => {
      expect(mockIs).toHaveBeenCalledWith("parent_id", null);
    });
  });

  it("should add likes count and user_has_liked to comments", async () => {
    // Mock likes
    mockIn.mockResolvedValueOnce({
      data: [{ comment_id: "comment-1" }, { comment_id: "comment-1" }],
      error: null,
    });
    // Mock user likes
    mockIn.mockResolvedValueOnce({
      data: [{ comment_id: "comment-1" }],
      error: null,
    });
    // Mock replies count
    mockIn.mockResolvedValueOnce({
      data: [{ parent_id: "comment-1" }],
      error: null,
    });

    const { result } = renderHook(() => useComments("post-1", "user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.comments[0].likes_count).toBe(2);
    expect(result.current.comments[0].user_has_liked).toBe(true);
    expect(result.current.comments[0].replies_count).toBe(1);
  });

  it("should handle empty comments", async () => {
    mockRange.mockResolvedValue({
      data: [],
      error: null,
    });

    const { result } = renderHook(() => useComments("post-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.comments).toHaveLength(0);
    expect(result.current.hasMore).toBe(false);
  });

  it("should handle fetch error gracefully", async () => {
    mockRange.mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useComments("post-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should add new comment", async () => {
    const { result } = renderHook(() => useComments("post-1", "user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const response = await result.current.addComment("user-1", "New comment!");
      expect(response.success).toBe(true);
    });

    expect(mockInsert).toHaveBeenCalledWith({
      post_id: "post-1",
      user_id: "user-1",
      content: "New comment!",
      parent_id: null,
    });
  });

  it("should add reply to comment", async () => {
    const { result } = renderHook(() => useComments("post-1", "user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const response = await result.current.addComment("user-1", "This is a reply", "comment-1");
      expect(response.success).toBe(true);
    });

    expect(mockInsert).toHaveBeenCalledWith({
      post_id: "post-1",
      user_id: "user-1",
      content: "This is a reply",
      parent_id: "comment-1",
    });
  });

  it("should delete comment", async () => {
    mockEq.mockReturnValue({
      is: mockIs,
      eq: vi.fn().mockResolvedValue({ error: null }),
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

  it("should load more comments (pagination)", async () => {
    // First call returns full page
    mockRange.mockResolvedValueOnce({
      data: mockComments,
      error: null,
    });

    const { result } = renderHook(() => useComments("post-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Mock second page
    mockRange.mockResolvedValueOnce({
      data: [
        {
          id: "comment-3",
          post_id: "post-1",
          user_id: "user-3",
          content: "Third comment",
          parent_id: null,
          created_at: "2024-01-03T00:00:00Z",
          author: { username: "thirduser", display_name: "Third", avatar_url: null },
        },
      ],
      error: null,
    });

    await act(async () => {
      await result.current.loadMore();
    });

    // Should append new comments
    expect(result.current.comments.length).toBeGreaterThanOrEqual(2);
  });

  it("should fetch replies for a comment", async () => {
    const mockReplies = [
      {
        id: "reply-1",
        post_id: "post-1",
        user_id: "user-2",
        content: "Reply content",
        parent_id: "comment-1",
        created_at: "2024-01-02T00:00:00Z",
        author: { username: "replier", display_name: "Replier", avatar_url: null },
      },
    ];

    mockEq.mockReturnValue({
      is: mockIs,
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockReplies,
          error: null,
        }),
      }),
    });

    const { result } = renderHook(() => useComments("post-1", "user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const replies = await result.current.fetchReplies("comment-1");
      expect(replies).toHaveLength(1);
      expect(replies[0].content).toBe("Reply content");
    });
  });

  it("should refetch comments", async () => {
    const { result } = renderHook(() => useComments("post-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Clear mock calls
    mockRange.mockClear();

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockRange).toHaveBeenCalled();
  });
});
