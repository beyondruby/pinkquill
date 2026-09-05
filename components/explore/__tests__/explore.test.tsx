import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const auth = { user: null as null | { id: string }, loading: false };
const explore = {
  posts: [] as unknown[],
  loading: false,
  error: null as string | null,
  pagination: { hasMore: false },
  loadMore: vi.fn(),
  refresh: vi.fn(),
  activeTab: "for-you" as string,
  setActiveTab: vi.fn((id: string) => { explore.activeTab = id; }),
};
const tags = { tags: [] as { name: string; post_count: number; recent_posts: number }[], loading: false };

vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("@/lib/hooks/useExplore", () => ({ useExplore: () => explore }));
vi.mock("@/lib/hooks/useTags", () => ({ useTrendingTags: () => tags }));
vi.mock("@/components/feed/PostCard", () => ({ default: ({ post }: { post: { id: string } }) => <article className="post">post {post.id}</article> }));

import ExplorePageContent from "../ExplorePageContent";
import { TabRow } from "@/components/ui/Tabs";

beforeEach(() => {
  auth.user = null;
  explore.posts = [];
  explore.loading = false;
  explore.error = null;
  explore.activeTab = "for-you";
  explore.setActiveTab.mockClear();
  explore.refresh.mockClear();
  tags.tags = [];
});

describe("TabRow", () => {
  it("has tablist semantics, one tab in the tab order, and arrow-key movement", () => {
    const onChange = vi.fn();
    render(<TabRow ariaLabel="Sections" value="b" onChange={onChange} items={[{ id: "a", label: "A" }, { id: "b", label: "B", count: 3 }, { id: "c", label: "C" }]} />);
    const list = screen.getByRole("tablist", { name: "Sections" });
    expect(screen.getByRole("tab", { name: "B3" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("c");
    fireEvent.keyDown(list, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("a");
    fireEvent.click(screen.getByRole("tab", { name: "C" }));
    expect(onChange).toHaveBeenLastCalledWith("c");
  });
});

describe("Explore", () => {
  it("shows the four ways to look around and a type filter, and switches tabs", async () => {
    render(<ExplorePageContent />);
    expect(screen.getByRole("heading", { level: 1, name: "Explore" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["For you", "Trending", "Communities", "Topics"]);
    fireEvent.click(screen.getByRole("tab", { name: "Trending" }));
    expect(explore.setActiveTab).toHaveBeenCalledWith("trending");

    fireEvent.click(screen.getByRole("button", { name: "Post type: all" }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Poetry" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("menuitem", { name: "Poetry" }));
    expect(explore.setActiveTab).toHaveBeenCalledWith("poem");
  });

  it("keeps a type filter visible in the trigger and offers a way back to all types when empty", () => {
    explore.activeTab = "poem";
    render(<ExplorePageContent />);
    expect(screen.getByRole("button", { name: "Post type: Poetry" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "For you" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("No poetry yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all types" }));
    expect(explore.setActiveTab).toHaveBeenCalledWith("for-you");
  });

  it("reports a failure with retry and lists topics as rows without rank badges", () => {
    explore.error = "Network down";
    const { unmount } = render(<ExplorePageContent />);
    expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(explore.refresh).toHaveBeenCalledOnce();
    unmount();

    explore.error = null;
    explore.activeTab = "topics";
    tags.tags = [{ name: "ink", post_count: 12, recent_posts: 3 }, { name: "clay", post_count: 1, recent_posts: 0 }];
    render(<ExplorePageContent />);
    expect(screen.queryByRole("button", { name: /Post type/ })).toBeNull();
    const ink = screen.getByRole("link", { name: /#ink/ });
    expect(ink).toHaveAttribute("href", "/tag/ink");
    expect(ink).toHaveTextContent("12 posts · 3 this week");
    expect(screen.getByRole("link", { name: /#clay/ })).toHaveTextContent("1 post");
    expect(screen.queryByText("1", { selector: "div" })).toBeNull();
  });
});
