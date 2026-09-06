import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import StudioHeader, { followWord, formatStudioCount } from "../StudioHeader";
import type { Profile } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/studio/poet" }));

const profile: Profile = {
  id: "p1",
  username: "poet",
  display_name: "Poet",
  avatar_url: null,
  cover_url: null,
  bio: "Poems about harbours.",
  tagline: "Writes at night",
  role: "Poet",
  education: null,
  location: "Jeddah",
  languages: null,
  website: null,
  is_verified: true,
  is_private: false,
  theme_preference: null,
  notification_preferences: null,
  created_at: "2026-01-15T00:00:00Z",
  works_count: 12,
  followers_count: 1200,
  following_count: 8,
  admires_count: 1_500_000,
};

function renderHeader(overrides: Partial<React.ComponentProps<typeof StudioHeader>> = {}) {
  const props: React.ComponentProps<typeof StudioHeader> = {
    profile,
    isOwnProfile: false,
    signedIn: true,
    followStatus: null,
    followLoading: false,
    onFollow: vi.fn(),
    messageLoading: false,
    onMessage: vi.fn(),
    isBlocked: false,
    onBlock: vi.fn(),
    onReport: vi.fn(),
    onShare: vi.fn(),
    onCopyLink: vi.fn(),
    onOpenFollowers: vi.fn(),
    communities: [],
    onOpenCommunities: vi.fn(),
    gated: false,
    ...overrides,
  };
  render(<StudioHeader {...props} />);
  return props;
}

describe("studio words", () => {
  it("says the right follow word for each state", () => {
    expect(followWord(null, false)).toBe("Follow");
    expect(followWord(null, true)).toBe("Ask to follow");
    expect(followWord("pending", true)).toBe("Requested");
    expect(followWord("accepted", false)).toBe("Following");
    expect(formatStudioCount(1200)).toBe("1.2k");
    expect(formatStudioCount(1_500_000)).toBe("1.5m");
    expect(formatStudioCount(null)).toBe("–");
  });
});

describe("StudioHeader", () => {
  it("shows the person, their counts and the visitor actions", () => {
    const props = renderHeader();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Poet");
    expect(screen.getByLabelText("Verified")).toBeInTheDocument();
    expect(screen.getByText("@poet")).toBeInTheDocument();
    expect(screen.getByText("Writes at night")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Message/ })).toBeInTheDocument();
    expect(screen.queryByText("Edit profile")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "1.2k followers" }));
    expect(props.onOpenFollowers).toHaveBeenCalledWith("followers");
    expect(screen.getByText("Poems about harbours.")).toBeInTheDocument();
    expect(screen.getByText("Jeddah")).toBeInTheDocument();
    expect(screen.getByText(/Joined January 2026/)).toBeInTheDocument();
  });

  it("gives the owner an edit link and no follow button", () => {
    renderHeader({ isOwnProfile: true });
    expect(screen.getByText("Edit profile")).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("button", { name: "Follow" })).toBeNull();
  });

  it("keeps a gated private studio to a note and two counts", () => {
    renderHeader({ gated: true, followStatus: "pending", profile: { ...profile, is_private: true } });
    expect(screen.getByText("This studio is private")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Requested" })).toBeInTheDocument();
    expect(screen.queryByText("Poems about harbours.")).toBeNull();
    expect(screen.queryByText("12 posts")).toBeNull();
  });
});
