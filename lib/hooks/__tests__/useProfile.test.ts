import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProfile, useFollow, useFollowList, useFollowRequests } from "../useProfile";

// Mock Supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockRange = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
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

    // Setup default mock chain
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        };
      }
      if (table === "blocks") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: mockMaybeSingle,
              }),
            }),
          }),
        };
      }
      if (table === "follows") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "posts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: mockPosts,
                    error: null,
                  }),
                  then: vi.fn(),
                }),
              }),
            }),
          }),
        };
      }
      return { select: mockSelect };
    });

    mockSingle.mockResolvedValue({
      data: mockProfile,
      error: null,
    });

    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
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
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    });

    const { result } = renderHook(() => useProfile("nonexistent"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("User not found");
    expect(result.current.profile).toBeNull();
  });

  it("should detect blocked state", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: "block-1" },
      error: null,
    });

    const { result } = renderHook(() => useProfile("testuser", "viewer-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isBlockedByUser).toBe(true);
    expect(result.current.error).toBe("blocked");
  });

  it("should handle private accounts", async () => {
    mockSingle.mockResolvedValue({
      data: { ...mockProfile, is_private: true },
      error: null,
    });

    const { result } = renderHook(() => useProfile("testuser", "viewer-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isPrivateAccount).toBe(true);
    expect(result.current.posts).toHaveLength(0);
  });

  it("should fetch posts for own profile", async () => {
    const { result } = renderHook(() => useProfile("testuser", "user-123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Own profile should see all posts
    expect(result.current.isPrivateAccount).toBe(false);
  });

  it("should refetch profile", async () => {
    const { result } = renderHook(() => useProfile("testuser"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockSingle.mockClear();

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockSingle).toHaveBeenCalled();
  });
});

describe("useFollow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      delete: mockDelete,
      update: mockUpdate,
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
    });

    mockEq.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
        single: mockSingle,
      }),
      maybeSingle: mockMaybeSingle,
    });

    mockInsert.mockResolvedValue({ error: null });
    mockDelete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("should check follow status", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { status: "accepted" },
      error: null,
    });

    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const status = await result.current.checkFollowStatus("follower-1", "following-1");
      expect(status).toBe("accepted");
    });
  });

  it("should return null when not following", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const status = await result.current.checkFollowStatus("follower-1", "following-1");
      expect(status).toBeNull();
    });
  });

  it("should follow user", async () => {
    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const response = await result.current.follow("follower-1", "following-1");
      expect(response.success).toBe(true);
    });

    expect(mockInsert).toHaveBeenCalledWith({
      follower_id: "follower-1",
      following_id: "following-1",
      status: "accepted",
    });
  });

  it("should send follow request to private account", async () => {
    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const response = await result.current.follow("follower-1", "following-1", true);
      expect(response.success).toBe(true);
    });

    expect(mockInsert).toHaveBeenCalledWith({
      follower_id: "follower-1",
      following_id: "following-1",
      status: "pending",
    });
  });

  it("should unfollow user", async () => {
    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const response = await result.current.unfollow("follower-1", "following-1");
      expect(response.success).toBe(true);
    });
  });

  it("should accept follow request", async () => {
    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const response = await result.current.acceptRequest("requester-1", "user-1");
      expect(response.success).toBe(true);
    });
  });

  it("should decline follow request", async () => {
    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const response = await result.current.declineRequest("requester-1", "user-1");
      expect(response.success).toBe(true);
    });
  });

  it("should check if user is private", async () => {
    mockSingle.mockResolvedValue({
      data: { is_private: true },
      error: null,
    });

    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const isPrivate = await result.current.checkIsPrivate("user-1");
      expect(isPrivate).toBe(true);
    });
  });

  it("should toggle follow state", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useFollow());

    await act(async () => {
      const response = await result.current.toggle("follower-1", "following-1", null, false);
      expect(response.success).toBe(true);
      expect(response.newStatus).toBe("accepted");
    });
  });
});

describe("useFollowList", () => {
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
    mockEq.mockReturnValue({
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

    mockFrom.mockReturnValue({
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
    });

    mockSelect.mockReturnValue({
      eq: mockEq,
    });

    mockEq.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: mockOrder,
      }),
    });

    mockOrder.mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            follower_id: "requester-1",
            requested_at: "2024-01-01T00:00:00Z",
            follower: {
              id: "requester-1",
              username: "requester1",
              display_name: "Requester One",
              avatar_url: null,
            },
          },
        ],
        error: null,
      }),
    });

    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mockDelete.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
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

  it("should fetch follow requests", async () => {
    const { result } = renderHook(() => useFollowRequests("user-1"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.requests).toHaveLength(1);
    expect(result.current.count).toBe(1);
  });

  it("should accept follow request", async () => {
    const { result } = renderHook(() => useFollowRequests("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const success = await result.current.accept("requester-1");
      expect(success).toBe(true);
    });
  });

  it("should decline follow request", async () => {
    const { result } = renderHook(() => useFollowRequests("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const success = await result.current.decline("requester-1");
      expect(success).toBe(true);
    });
  });

  it("should not fetch when no userId", async () => {
    const { result } = renderHook(() => useFollowRequests(undefined));

    expect(result.current.loading).toBe(false);
    expect(result.current.requests).toHaveLength(0);
  });
});
