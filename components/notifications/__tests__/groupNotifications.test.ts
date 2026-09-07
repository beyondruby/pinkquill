import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/hooks/useNotifications", () => ({ useNotifications: vi.fn(), useMarkAsRead: vi.fn() }));
vi.mock("@/lib/hooks.legacy", () => ({ useCollaborationInvites: vi.fn() }));
vi.mock("@/lib/hooks/useProfile", () => ({ useFollowRequests: vi.fn() }));

import { groupNotifications } from "../NotificationPanel";
import type { Notification } from "@/lib/types";

const n = (id: string, type: Notification["type"], actor: string, post: string | null, take: string | null = null): Notification =>
  ({ id, type, actor_id: actor, post_id: post, take_id: take, user_id: "me", comment_id: null, community_id: null, order_id: null, content: null, read: false, created_at: id, actor: { username: actor, display_name: null, avatar_url: null } }) as Notification;

describe("groupNotifications", () => {
  it("folds consecutive reactions on the same post from different people into one row", () => {
    const groups = groupNotifications([
      n("1", "admire", "a", "p1"),
      n("2", "snap", "b", "p1"),
      n("3", "comment", "c", "p1"),
      n("4", "applaud", "d", "p2"),
      n("5", "applaud", "e", null, "t1"),
      n("6", "admire", "f", null, "t1"),
    ]);
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([["1", "2"], ["3"], ["4"], ["5", "6"]]);
  });

  it("never merges two rows from the same actor", () => {
    const groups = groupNotifications([n("1", "admire", "a", "p1"), n("2", "snap", "a", "p1")]);
    expect(groups).toHaveLength(2);
  });
});
