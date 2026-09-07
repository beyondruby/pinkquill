import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));

import {
  __resetEngagementStore,
  applyLiveCounts,
  clearReaction,
  emptyReactionCounts,
  ensureReactionLoaded,
  getReaction,
  seedReaction,
  setEngagementViewer,
  setReaction,
  subscribeReaction,
  toggleDefaultReaction,
  toggleReaction,
} from "../store";

const counts = (over: Partial<ReturnType<typeof emptyReactionCounts>> = {}) => ({ ...emptyReactionCounts(), ...over });

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  __resetEngagementStore();
  mocks.rpc.mockReset();
  vi.useRealTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("seedReaction", () => {
  it("seeds a total without pretending to know the per-type split", () => {
    seedReaction("post", "p1", { total: 5, mine: null, viewerId: "u1" });
    const e = getReaction("post", "p1");
    expect(e.counts.total).toBe(5);
    expect(e.totalLoaded).toBe(true);
    expect(e.countsLoaded).toBe(false);
    expect(e.mine).toBeNull();
    expect(e.mineFor).toBe("u1");
  });

  it("a new total from a list refetch invalidates a stale per-type split", () => {
    seedReaction("post", "p1", { counts: counts({ admire: 2, total: 2 }), mine: null, viewerId: "u1" });
    expect(getReaction("post", "p1").countsLoaded).toBe(true);
    seedReaction("post", "p1", { total: 3 });
    const e = getReaction("post", "p1");
    expect(e.counts.total).toBe(3);
    expect(e.countsLoaded).toBe(false);
  });

  it("does not overwrite the server's answer with a stale list row right after a write", async () => {
    seedReaction("post", "p1", { total: 1, mine: null, viewerId: "u1" });
    mocks.rpc.mockResolvedValue({
      data: { mine: "snap", previous: null, changed: true, counts: counts({ snap: 1, total: 2 }) },
      error: null,
    });
    await setReaction("post", "p1", "u1", "snap");
    seedReaction("post", "p1", { total: 1, mine: null, viewerId: "u1" }); // stale refetch
    const e = getReaction("post", "p1");
    expect(e.mine).toBe("snap");
    expect(e.counts.total).toBe(2);
  });
});

describe("setReaction / clearReaction", () => {
  it("updates optimistically, then writes back what the server returned", async () => {
    seedReaction("post", "p1", { total: 4, mine: null, viewerId: "u1" });
    const d = deferred<{ data: unknown; error: null }>();
    mocks.rpc.mockReturnValue(d.promise);
    const listener = vi.fn();
    subscribeReaction("post", "p1", listener);

    const pending = setReaction("post", "p1", "u1", "ovation");
    let e = getReaction("post", "p1");
    expect(e.pending).toBe(true);
    expect(e.mine).toBe("ovation");
    expect(e.counts.total).toBe(5);
    expect(e.counts.ovation).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledWith("set_post_reaction", { p_post_id: "p1", p_type: "ovation" });

    d.resolve({
      data: { mine: "ovation", previous: null, changed: true, counts: counts({ ovation: 3, admire: 4, total: 7 }) },
      error: null,
    });
    const result = await pending;
    e = getReaction("post", "p1");
    expect(result).toMatchObject({ ok: true, added: true, changed: false, removed: false, mine: "ovation" });
    expect(e.pending).toBe(false);
    expect(e.counts).toEqual(counts({ ovation: 3, admire: 4, total: 7 }));
    expect(e.countsLoaded).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it("reports a change when the server had a different previous reaction", async () => {
    seedReaction("post", "p1", { total: 1, mine: "admire", viewerId: "u1" });
    mocks.rpc.mockResolvedValue({
      data: { mine: "snap", previous: "admire", changed: true, counts: counts({ snap: 1, total: 1 }) },
      error: null,
    });
    const result = await setReaction("post", "p1", "u1", "snap");
    expect(result).toMatchObject({ ok: true, added: false, changed: true, removed: false });
    expect(getReaction("post", "p1").counts.total).toBe(1);
  });

  it("reverts and reports failure when the RPC errors", async () => {
    seedReaction("post", "p1", { total: 4, mine: null, viewerId: "u1" });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const result = await setReaction("post", "p1", "u1", "admire");
    const e = getReaction("post", "p1");
    expect(result.ok).toBe(false);
    expect(e.mine).toBeNull();
    expect(e.counts.total).toBe(4);
    expect(e.pending).toBe(false);
  });

  it("ignores a second click while the first write is in flight", async () => {
    seedReaction("post", "p1", { total: 0, mine: null, viewerId: "u1" });
    const d = deferred<{ data: unknown; error: null }>();
    mocks.rpc.mockReturnValue(d.promise);
    const first = setReaction("post", "p1", "u1", "admire");
    const second = await setReaction("post", "p1", "u1", "admire");
    expect(second.ok).toBe(false);
    expect(second.error).toBe("pending");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    d.resolve({ data: { mine: "admire", previous: null, changed: true, counts: counts({ admire: 1, total: 1 }) }, error: null });
    await first;
    expect(getReaction("post", "p1").counts.total).toBe(1);
  });

  it("clearReaction calls the clear RPC and reports removal", async () => {
    seedReaction("take", "t1", { total: 2, mine: "applaud", viewerId: "u1" });
    mocks.rpc.mockResolvedValue({
      data: { mine: null, previous: "applaud", changed: true, counts: counts({ total: 1, snap: 1 }) },
      error: null,
    });
    const result = await clearReaction("take", "t1", "u1");
    expect(mocks.rpc).toHaveBeenCalledWith("clear_take_reaction", { p_take_id: "t1" });
    expect(result).toMatchObject({ ok: true, removed: true, mine: null });
    expect(getReaction("take", "t1").counts.total).toBe(1);
  });

  it("toggleReaction removes on the same type and toggleDefault admires when none", async () => {
    seedReaction("post", "p1", { total: 1, mine: "snap", viewerId: "u1" });
    mocks.rpc.mockResolvedValue({ data: { mine: null, previous: "snap", changed: true, counts: counts() }, error: null });
    await toggleReaction("post", "p1", "u1", "snap");
    expect(mocks.rpc).toHaveBeenLastCalledWith("clear_post_reaction", { p_post_id: "p1" });

    mocks.rpc.mockResolvedValue({
      data: { mine: "admire", previous: null, changed: true, counts: counts({ admire: 1, total: 1 }) },
      error: null,
    });
    await toggleDefaultReaction("post", "p1", "u1");
    expect(mocks.rpc).toHaveBeenLastCalledWith("set_post_reaction", { p_post_id: "p1", p_type: "admire" });
  });
});

describe("ensureReactionLoaded", () => {
  it("coalesces requests made in the same tick into one batched RPC", async () => {
    setEngagementViewer("u1");
    mocks.rpc.mockResolvedValue({
      data: [
        { id: "a", admire: 2, snap: 0, ovation: 0, support: 0, inspired: 0, applaud: 0, total: 2, mine: "admire" },
        { id: "b", admire: 0, snap: 1, ovation: 0, support: 0, inspired: 0, applaud: 0, total: 1, mine: null },
      ],
      error: null,
    });
    await Promise.all([ensureReactionLoaded("post", "a"), ensureReactionLoaded("post", "b")]);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("get_post_reaction_summary", { p_ids: ["a", "b"] });
    const a = getReaction("post", "a");
    expect(a.mine).toBe("admire");
    expect(a.mineFor).toBe("u1");
    expect(a.counts.total).toBe(2);
    expect(a.countsLoaded).toBe(true);
    expect(getReaction("post", "b").counts.snap).toBe(1);
  });

  it("does not clobber an entry with a write in flight", async () => {
    seedReaction("post", "a", { total: 0, mine: null, viewerId: "u1" });
    const write = deferred<{ data: unknown; error: null }>();
    mocks.rpc.mockImplementation((fn: string) =>
      fn === "set_post_reaction"
        ? write.promise
        : Promise.resolve({
            data: [{ id: "a", admire: 0, snap: 0, ovation: 0, support: 0, inspired: 0, applaud: 0, total: 0, mine: null }],
            error: null,
          })
    );
    const pending = setReaction("post", "a", "u1", "admire");
    await ensureReactionLoaded("post", "a");
    expect(getReaction("post", "a").mine).toBe("admire"); // stale summary ignored
    write.resolve({ data: { mine: "admire", previous: null, changed: true, counts: counts({ admire: 1, total: 1 }) }, error: null });
    await pending;
    expect(getReaction("post", "a").counts.total).toBe(1);
  });
});

describe("applyLiveCounts (content-events broadcast)", () => {
  it("overrides loaded counts and the comment count with the server's numbers", () => {
    seedReaction("post", "p1", { total: 2, mine: null, viewerId: "u1" });
    applyLiveCounts("post", "p1", counts({ admire: 2, snap: 1, total: 3 }), 7);
    const e = getReaction("post", "p1");
    expect(e.counts.total).toBe(3);
    expect(e.counts.snap).toBe(1);
    expect(e.countsLoaded).toBe(true);
    expect(e.comments).toBe(7);
    expect(e.commentsLoaded).toBe(true);
  });

  it("notifies subscribers", () => {
    const listener = vi.fn();
    subscribeReaction("post", "p1", listener);
    applyLiveCounts("post", "p1", counts({ admire: 1, total: 1 }));
    expect(listener).toHaveBeenCalled();
  });

  it("is ignored while this tab has a write in flight or one just landed", async () => {
    setEngagementViewer("u1");
    const d = deferred<{ data: unknown; error: null }>();
    mocks.rpc.mockReturnValueOnce(d.promise);
    const write = setReaction("post", "p1", "u1", "snap");
    applyLiveCounts("post", "p1", counts({ admire: 9, total: 9 }), 4);
    expect(getReaction("post", "p1").counts.total).toBe(1);
    d.resolve({ data: { mine: "snap", previous: null, counts: counts({ snap: 1, total: 1 }) }, error: null });
    await write;
    applyLiveCounts("post", "p1", counts({ admire: 9, total: 9 }), 4);
    expect(getReaction("post", "p1").counts.total).toBe(1);
  });
});
