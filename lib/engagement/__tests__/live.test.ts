import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const channels: Array<{ topic: string; handlers: Array<(msg: { payload: unknown }) => void>; subscribed: boolean }> = [];
  return {
    channels,
    channel: vi.fn((topic: string) => {
      const entry = { topic, handlers: [] as Array<(msg: { payload: unknown }) => void>, subscribed: false };
      channels.push(entry);
      const ch = {
        on: vi.fn((_type: string, _filter: unknown, handler: (msg: { payload: unknown }) => void) => {
          entry.handlers.push(handler);
          return ch;
        }),
        subscribe: vi.fn(() => {
          entry.subscribed = true;
          return ch;
        }),
        __entry: entry,
      };
      return ch;
    }),
    removeChannel: vi.fn(),
    rpc: vi.fn(),
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { channel: mocks.channel, removeChannel: mocks.removeChannel, rpc: mocks.rpc },
}));

import { __resetContentEvents, subscribeContentEvents } from "../live";
import { __resetEngagementStore, emptyReactionCounts, getReaction } from "../store";

beforeEach(() => {
  __resetContentEvents();
  __resetEngagementStore();
  mocks.channels.length = 0;
  mocks.channel.mockClear();
  mocks.removeChannel.mockClear();
});

describe("subscribeContentEvents", () => {
  it("opens one channel per post and shares it between subscribers", () => {
    const off1 = subscribeContentEvents("post", "p1");
    const off2 = subscribeContentEvents("post", "p1", () => {});
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    expect(mocks.channel).toHaveBeenCalledWith("content-events:post:p1");
    off1();
    expect(mocks.removeChannel).not.toHaveBeenCalled();
    off2();
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("writes broadcast counts into the store and forwards comment events", () => {
    const listener = vi.fn();
    subscribeContentEvents("post", "p1", listener);
    const payload = {
      kind: "post",
      id: "p1",
      what: "comment",
      op: "INSERT",
      counts: { ...emptyReactionCounts(), admire: 2, total: 2 },
      comments: 5,
      actor_id: "u2",
      comment_id: "c1",
      parent_id: null,
    };
    mocks.channels[0].handlers[0]({ payload });
    const e = getReaction("post", "p1");
    expect(e.counts.total).toBe(2);
    expect(e.comments).toBe(5);
    expect(listener).toHaveBeenCalledWith(payload);
  });

  it("ignores a payload for a different id", () => {
    subscribeContentEvents("post", "p1");
    mocks.channels[0].handlers[0]({ payload: { id: "p2", counts: { ...emptyReactionCounts(), total: 9 }, comments: 1 } });
    expect(getReaction("post", "p1").counts.total).toBe(0);
  });
});
