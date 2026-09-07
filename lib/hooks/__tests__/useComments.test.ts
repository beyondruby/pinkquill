import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useComments } from "../useComments";
import { __resetEngagementStore, getReaction, seedReaction } from "@/lib/engagement/store";

// ---- Supabase mock: a tiny query builder + rpc ---------------------------------
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  selectResult: vi.fn(), // (table, filters) => { data, error }
  notification: vi.fn(),
}));

function makeQuery(table: string) {
  const filters: Record<string, unknown> = { table };
  const q: Record<string, unknown> = {};
  const chain = (name: string) =>
    ((...args: unknown[]) => {
      filters[name] = args;
      return q;
    }) as unknown;
  for (const m of ["select", "eq", "is", "in", "order", "range", "abortSignal", "neq"]) q[m] = chain(m);
  q.maybeSingle = () => Promise.resolve(mocks.selectResult(table, { ...filters, maybeSingle: true }));
  q.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(mocks.selectResult(table, filters)).then(resolve, reject);
  return q;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => makeQuery(table),
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  },
}));
vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "viewer" },
    profile: { username: "viewer", display_name: "Viewer", avatar_url: null },
  }),
}));
vi.mock("../useNotifications", () => ({ createNotification: mocks.notification }));

const author = { username: "alice", display_name: "Alice", avatar_url: null };
const topRow = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  user_id: "alice-id",
  post_id: "post-1",
  parent_id: null,
  reply_to_user_id: null,
  reply_to: null,
  content: `comment ${id}`,
  created_at: "2026-09-01T00:00:00Z",
  author,
  likes_agg: [{ count: 2 }],
  replies_agg: [{ count: 1 }],
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  __resetEngagementStore();
  mocks.notification.mockResolvedValue(true);
  // default: one page with one top-level comment, no likes by the viewer
  mocks.selectResult.mockImplementation((table: string, f: Record<string, unknown>) => {
    if (table === "comments" && f.is) return { data: [topRow("c1")], error: null };
    if (table === "comment_likes") return { data: [], error: null };
    return { data: [], error: null };
  });
});

describe("useComments (post)", () => {
  it("loads the first page with embedded aggregates and the viewer's likes", async () => {
    mocks.selectResult.mockImplementation((table: string, f: Record<string, unknown>) => {
      if (table === "comments" && f.is) return { data: [topRow("c1"), topRow("c2")], error: null };
      if (table === "comment_likes") return { data: [{ comment_id: "c2" }], error: null };
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useComments("post", "post-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comments).toHaveLength(2);
    expect(result.current.comments[0]).toMatchObject({ id: "c1", likes_count: 2, replies_count: 1, user_has_liked: false });
    expect(result.current.comments[1].user_has_liked).toBe(true);
    expect(result.current.hasMore).toBe(false); // < page size
  });

  it("adds a comment optimistically, confirms it from the RPC and updates the shared count", async () => {
    seedReaction("post", "post-1", { comments: 1 });
    let resolveRpc!: (v: unknown) => void;
    mocks.rpc.mockReturnValue(new Promise((r) => (resolveRpc = r)));
    mocks.selectResult.mockImplementation((table: string, f: Record<string, unknown>) => {
      if (table === "comments" && f.is) return { data: [topRow("c1")], error: null };
      if (table === "comments" && f.maybeSingle) return { data: topRow("new-1", { content: "hello", user_id: "viewer" }), error: null };
      return { data: [], error: null };
    });
    const { result } = renderHook(() => useComments("post", "post-1", { authorId: "author-1" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.addComment("hello");
    });
    // optimistic row at the top, count nudged
    expect(result.current.comments[0]).toMatchObject({ content: "hello", pending: true });
    expect(getReaction("post", "post-1").comments).toBe(2);

    resolveRpc({ data: { id: "new-1", created_at: "2026-09-01T00:00:01Z", parent_id: null, reply_to_user_id: null, comments_count: 5 }, error: null });
    await act(async () => {
      await pending;
    });
    expect(mocks.rpc).toHaveBeenCalledWith("add_post_comment", {
      p_post_id: "post-1",
      p_content: "hello",
      p_parent_id: null,
      p_reply_to_user_id: null,
    });
    expect(result.current.comments[0].id).toBe("new-1");
    expect(result.current.comments[0].pending).toBeFalsy();
    expect(getReaction("post", "post-1").comments).toBe(5);
    // Notifications are database triggers now: nothing is inserted from the client.
    expect(mocks.notification).not.toHaveBeenCalled();
  });

  it("rolls the optimistic comment back when the RPC fails", async () => {
    seedReaction("post", "post-1", { comments: 1 });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "nope" } });
    const { result } = renderHook(() => useComments("post", "post-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let res!: { success: boolean };
    await act(async () => {
      res = await result.current.addComment("hello");
    });
    expect(res.success).toBe(false);
    expect(result.current.comments.some((c) => c.content === "hello")).toBe(false);
    expect(getReaction("post", "post-1").comments).toBe(1);
  });

  it("attaches a reply under its parent without client-side notifications", async () => {
    mocks.rpc.mockResolvedValue({
      data: { id: "r1", created_at: "2026-09-01T00:00:02Z", parent_id: "c1", reply_to_user_id: "bob-id", comments_count: 3 },
      error: null,
    });
    const { result } = renderHook(() => useComments("post", "post-1", { authorId: "author-1" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.addComment("hi bob", { parentId: "c1", replyToUserId: "bob-id" });
    });
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(result.current.comments[0].replies_count).toBe(2);
  });

  it("toggles a like optimistically and writes back the server count", async () => {
    mocks.rpc.mockResolvedValue({ data: { liked: true, likes_count: 9 }, error: null });
    const { result } = renderHook(() => useComments("post", "post-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.toggleLike("c1");
    });
    expect(mocks.rpc).toHaveBeenCalledWith("set_post_comment_like", { p_comment_id: "c1", p_liked: true });
    expect(result.current.comments[0]).toMatchObject({ user_has_liked: true, likes_count: 9 });
  });

  it("reverts a like when the RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { result } = renderHook(() => useComments("post", "post-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.toggleLike("c1");
    });
    expect(result.current.comments[0]).toMatchObject({ user_has_liked: false, likes_count: 2 });
  });

  it("deletes a comment through the RPC and takes the count from the server", async () => {
    seedReaction("post", "post-1", { comments: 4 });
    mocks.rpc.mockResolvedValue({ data: { deleted: 2, comments_count: 2 }, error: null });
    const { result } = renderHook(() => useComments("post", "post-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.deleteComment("c1");
    });
    expect(mocks.rpc).toHaveBeenCalledWith("delete_post_comment", { p_comment_id: "c1" });
    expect(result.current.comments).toHaveLength(0);
    expect(getReaction("post", "post-1").comments).toBe(2);
  });
});

describe("useComments (take)", () => {
  it("reads take tables and calls the take RPCs", async () => {
    mocks.selectResult.mockImplementation((table: string, f: Record<string, unknown>) => {
      if (table === "take_comments" && f.is) return { data: [topRow("t1", { take_id: "take-1" })], error: null };
      return { data: [], error: null };
    });
    mocks.rpc.mockResolvedValue({ data: { liked: true, likes_count: 1 }, error: null });
    const { result } = renderHook(() => useComments("take", "take-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comments[0].post_id).toBe("take-1");
    await act(async () => {
      await result.current.toggleLike("t1");
    });
    expect(mocks.rpc).toHaveBeenCalledWith("set_take_comment_like", { p_comment_id: "t1", p_liked: true });
  });
});
