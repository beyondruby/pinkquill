import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CommunityCard, { membershipWord } from "../CommunityCard";
import { COMMUNITY_CATEGORIES, categoryForTopics, formatMemberCount } from "@/lib/communities/categories";
import type { Community } from "@/lib/types";

const base: Community = {
  id: "c1",
  slug: "inkwell",
  name: "Inkwell",
  description: "Poems and the people who write them.",
  avatar_url: null,
  cover_url: null,
  privacy: "public",
  topics: ["Writing & Literature"],
  created_by: "u1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  member_count: 1200,
};

describe("community taxonomy", () => {
  it("has one list with unique ids and stored names", () => {
    const ids = new Set(COMMUNITY_CATEGORIES.map((c) => c.id));
    expect(ids.size).toBe(COMMUNITY_CATEGORIES.length);
    expect(categoryForTopics(["Writing & Literature"])?.id).toBe("writing");
    expect(categoryForTopics(["Learning & Critique"])?.label).toBe("Learning");
    expect(formatMemberCount(1200)).toBe("1.2k");
  });
});

describe("CommunityCard", () => {
  it("names the community with its member count and shows where the viewer stands", () => {
    render(<CommunityCard community={{ ...base, is_member: true, user_role: "moderator" }} />);
    expect(screen.getByRole("link", { name: "Inkwell, 1200 members" })).toHaveAttribute("href", "/community/inkwell");
    expect(screen.getByText("You moderate")).toBeInTheDocument();
    expect(screen.getByText("Public")).toBeInTheDocument();
  });

  it("maps membership to one word", () => {
    expect(membershipWord(base)).toBeNull();
    expect(membershipWord({ ...base, has_pending_request: true })).toBe("Requested");
    expect(membershipWord({ ...base, has_pending_invitation: true })).toBe("Invited");
    expect(membershipWord({ ...base, is_member: true, user_role: "admin" })).toBe("You run this");
  });
});
