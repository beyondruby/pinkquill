import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { filterWorks, mergeWorks, splitPinned, withAuthor } from "../works";
import { CollectionMark } from "../CollectionCard";
import type { Post, Profile } from "@/lib/types";

const profile = { id: "p1", username: "poet", display_name: "Poet", avatar_url: null, is_verified: false } as Profile;
const post = (over: Partial<Post>): Post => ({
  id: "x", author_id: "p1", type: "thought", title: null, content: "", created_at: "2026-09-01T00:00:00Z",
  media: [], admires_count: 0, reactions_count: 0, comments_count: 0, relays_count: 0,
  ...over,
} as unknown as Post);

describe("studio works helpers", () => {
  it("merges own and collaborated posts newest first without duplicates", () => {
    const merged = mergeWorks(
      [post({ id: "a", created_at: "2026-09-01T00:00:00Z" }), post({ id: "b", created_at: "2026-09-03T00:00:00Z" })],
      [post({ id: "a" }), post({ id: "c", created_at: "2026-09-02T00:00:00Z" })],
    );
    expect(merged.map((p) => p.id)).toEqual(["b", "c", "a"]);
    expect(merged.find((p) => p.id === "c")?.isCollaboration).toBe(true);
  });

  it("filters by kind and keeps community posts to the Communities view", () => {
    const works = mergeWorks([
      post({ id: "poem", type: "poem" }),
      post({ id: "journal", type: "journal" }),
      post({ id: "pic", type: "visual", media: [{ id: "m", media_url: "/x.jpg", media_type: "image" }] as Post["media"] }),
      post({ id: "in-community", type: "poem", community_id: "c1" }),
    ], []);
    expect(filterWorks(works, "all").map((p) => p.id)).toEqual(["poem", "journal", "pic"]);
    expect(filterWorks(works, "poems").map((p) => p.id)).toEqual(["poem"]);
    expect(filterWorks(works, "journals").map((p) => p.id)).toEqual(["journal"]);
    expect(filterWorks(works, "gallery").map((p) => p.id)).toEqual(["pic"]);
    expect(filterWorks(works, "communities").map((p) => p.id)).toEqual(["in-community"]);
  });

  it("puts pinned posts first in pin order and fills in the studio owner as author", () => {
    const works = [post({ id: "a" }), post({ id: "b" }), post({ id: "c" })];
    const { pinned, rest } = splitPinned(works, ["c", "a"]);
    expect(pinned.map((p) => p.id)).toEqual(["c", "a"]);
    expect(rest.map((p) => p.id)).toEqual(["b"]);
    expect(withAuthor(post({ id: "a" }), profile).author.username).toBe("poet");
    const own = post({ id: "b", author: { id: "q", username: "other", display_name: null, avatar_url: null } });
    expect(withAuthor(own, profile).author.username).toBe("other");
  });
});

describe("CollectionMark", () => {
  it("shows a named mark, an emoji from a code point, or the plain box", () => {
    const { container, rerender } = render(<CollectionMark collection={{ icon_emoji: "icon:book", icon_url: null }} />);
    expect(container.querySelector("svg")).not.toBeNull();
    rerender(<CollectionMark collection={{ icon_emoji: "1F9E1", icon_url: null }} />);
    expect(screen.getByText("🧡")).toBeInTheDocument();
    rerender(<CollectionMark collection={{ icon_emoji: null, icon_url: "/c.png" }} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "/c.png");
  });
});
