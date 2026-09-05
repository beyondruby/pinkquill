import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const auth = { user: null as null | { id: string }, profile: null as null | { username: string; avatar_url: string | null }, loading: false };
const feedView = { viewId: "classic" as "classic" | "compact" | "grid", setView: vi.fn((id: "classic" | "compact" | "grid") => { feedView.viewId = id; }), isReady: true };
const feed = {
  posts: [] as unknown[],
  loading: false,
  error: null as string | null,
  pagination: { hasMore: false },
  loadMore: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("@/components/providers/FeedViewProvider", () => ({ useFeedView: () => feedView }));
vi.mock("@/components/providers/ModalProvider", () => ({ useModal: () => ({ subscribeToDeletes: () => () => {}, openPostModal: vi.fn(), subscribeToUpdates: () => () => {}, notifyUpdate: vi.fn() }) }));
vi.mock("@/lib/hooks/useFeed", () => ({ useFeed: () => feed }));
vi.mock("../PostCard", () => ({ default: ({ post }: { post: { id: string } }) => <article className="post">post {post.id}</article> }));
vi.mock("../StreamView", () => ({ StreamFeed: () => <div>stream</div> }));
vi.mock("../GalleryView", () => ({ GalleryFeed: () => <div>gallery</div> }));

import Feed from "../Feed";
import { FeedViewSwitch } from "../FeedViewSwitch";

beforeEach(() => {
  auth.user = null;
  auth.profile = null;
  feedView.viewId = "classic";
  feedView.setView.mockClear();
  feed.posts = [];
  feed.loading = false;
  feed.error = null;
  feed.refresh.mockClear();
});

describe("FeedViewSwitch", () => {
  it("exposes the three layouts as a radio group and moves with arrow keys", () => {
    render(<FeedViewSwitch />);
    const group = screen.getByRole("radiogroup", { name: "Feed layout" });
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Classic", "Stream", "Gallery"]);
    expect(screen.getByRole("radio", { name: "Classic" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Gallery" }));
    expect(feedView.setView).toHaveBeenCalledWith("grid");
    fireEvent.keyDown(group, { key: "ArrowRight" });
    expect(feedView.setView).toHaveBeenLastCalledWith("compact");
  });
});

describe("Feed states", () => {
  it("tells a guest to sign in when the feed is empty, without the composer prompt", () => {
    render(<Feed />);
    expect(screen.getByRole("heading", { level: 1, name: "What people are making" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create a post" })).toBeNull();
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore");
  });

  it("invites a signed-in person to share and shows the composer prompt", () => {
    auth.user = { id: "u1" };
    auth.profile = { username: "noor", avatar_url: null };
    render(<Feed />);
    expect(screen.getByRole("heading", { level: 1, name: "From your creative world" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a post" })).toHaveAttribute("href", "/create");
    expect(screen.getByRole("link", { name: "Share something" })).toHaveAttribute("href", "/create");
  });

  it("separates a fetch failure from an empty feed and offers a retry", () => {
    feed.error = "Could not reach the studio";
    render(<Feed />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("The feed didn’t load");
    expect(alert).toHaveTextContent("Could not reach the studio");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(feed.refresh).toHaveBeenCalledOnce();
  });

  it("renders the classic column and the end-of-feed line", () => {
    feed.posts = [{ id: "p1", author_id: "a", author: { username: "lina", display_name: "Lina", avatar_url: null }, type: "thought", created_at: new Date().toISOString(), content: "hi", media: [], admires_count: 0, reactions_count: 0, comments_count: 0, relays_count: 0 }];
    render(<Feed />);
    expect(screen.getByText("post p1")).toBeInTheDocument();
    expect(screen.getByText("That’s everything for now.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders Stream and Gallery through their own views", () => {
    feed.posts = [{ id: "p1", author_id: "a", author: { username: "lina", display_name: "Lina", avatar_url: null }, type: "thought", created_at: new Date().toISOString(), content: "hi", media: [], admires_count: 0, reactions_count: 0, comments_count: 0, relays_count: 0 }];
    feedView.viewId = "compact";
    const { unmount } = render(<Feed />);
    expect(screen.getByText("stream")).toBeInTheDocument();
    unmount();
    feedView.viewId = "grid";
    render(<Feed />);
    expect(screen.getByText("gallery")).toBeInTheDocument();
  });
});
