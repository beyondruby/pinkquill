import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/feed/ReactionPicker", () => ({ default: ({ disabled }: { disabled?: boolean }) => <button disabled={disabled}>React</button> }));
vi.mock("@/components/feed/CommentItem", () => ({ default: ({ comment }: { comment: { id: string; content: string } }) => <div id={`comment-${comment.id}`}>{comment.content}</div> }));
vi.mock("@/components/feed/AudioPlayer", () => ({ AudioPlayer: () => <div>audio</div> }));

import PostDetailActions from "../PostDetailActions";
import Discussion from "../Discussion";
import PostDetailBody from "../PostDetailBody";
import PostDetailHeader from "../PostDetailHeader";
import { getDetailTone, type DetailPost } from "../types";

const counts = { admire: 2, snap: 0, ovation: 0, support: 0, total: 2 } as unknown as import("@/lib/types").ReactionCounts;

const post: DetailPost = {
  id: "p1",
  authorId: "a1",
  author: { name: "Lina Reyes", handle: "@lina", avatar: "/defaultprofile.png" },
  type: "visual",
  timeAgo: "2h ago",
  createdAt: "2026-09-05T10:00:00Z",
  title: "A place where the wild things grow",
  content: "<p>Paint-stained hands.</p>",
  media: [
    { id: "m1", media_url: "/a.png", media_type: "image", caption: "Sunroom", position: 0 },
    { id: "m2", media_url: "/b.png", media_type: "image", caption: null, position: 1 },
  ],
};

describe("PostDetailActions", () => {
  it("hides relay for the owner and disables relay/save for guests, keeping share available", () => {
    const onShare = vi.fn();
    const { rerender } = render(
      <PostDetailActions signedIn={false} isOwner={false} userReaction={null} reactionCounts={counts} onReact={vi.fn()} onRemoveReaction={vi.fn()} commentCount={3} onComment={vi.fn()} relayCount={1} isRelayed={false} onRelay={vi.fn()} onShare={onShare} isSaved={false} onSave={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /Relay, 1 relays/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /3 comments/ })).toBeInTheDocument();

    rerender(
      <PostDetailActions signedIn isOwner userReaction={null} reactionCounts={counts} onReact={vi.fn()} onRemoveReaction={vi.fn()} commentCount={3} onComment={vi.fn()} relayCount={1} isRelayed={false} onRelay={vi.fn()} onShare={onShare} isSaved onSave={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: /Relay/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Remove from saved" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Discussion", () => {
  it("asks guests to sign in and lets members submit with Enter", () => {
    const onSubmit = vi.fn();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Discussion comments={[]} loading={false} signedIn={false} signInHref="/login?redirect=%2Fpost%2Fp1" value="" onValueChange={onValueChange} onSubmit={onSubmit} submitting={false} onLike={vi.fn()} onReply={vi.fn()} />
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?redirect=%2Fpost%2Fp1");
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Add a comment")).toBeNull();

    rerender(
      <Discussion comments={[{ id: "c1", content: "Lovely light" } as never]} loading={false} signedIn currentUserId="u1" signInHref="/login" value="Thank you" onValueChange={onValueChange} onSubmit={onSubmit} submitting={false} onLike={vi.fn()} onReply={vi.fn()} />
    );
    expect(screen.getByText("Lovely light")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Conversation/ })).toHaveTextContent("1");
    fireEvent.submit(screen.getByLabelText("Add a comment").closest("form")!);
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Send comment" })).toBeEnabled();
  });
});

describe("PostDetailBody", () => {
  it("keeps a content warning in front until revealed and steps through media", () => {
    const onReveal = vi.fn();
    const onIndex = vi.fn();
    const warned = { ...post, contentWarning: "Bright flashing colours" };
    const { rerender } = render(
      <PostDetailBody post={warned} tone={getDetailTone(null)} headingLevel="h1" mediaIndex={0} onMediaIndexChange={onIndex} revealed={false} onReveal={onReveal} />
    );
    expect(screen.getByRole("group", { name: "Content warning" })).toHaveTextContent("Bright flashing colours");
    fireEvent.click(screen.getByRole("button", { name: "Show the work" }));
    expect(onReveal).toHaveBeenCalledOnce();

    rerender(<PostDetailBody post={warned} tone={getDetailTone(null)} headingLevel="h1" mediaIndex={0} onMediaIndexChange={onIndex} revealed onReveal={onReveal} />);
    expect(screen.queryByRole("group", { name: "Content warning" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: post.title })).toBeInTheDocument();
    expect(screen.getByText("Sunroom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onIndex).toHaveBeenCalledWith(1);
    expect(screen.getByRole("button", { name: "Image 1 of 2" })).toHaveAttribute("aria-current", "true");
  });
});

describe("PostDetailHeader", () => {
  it("links the creator to their studio and renders leading/trailing controls", () => {
    const onNavigate = vi.fn();
    render(<PostDetailHeader post={post} tone={getDetailTone(null)} onNavigate={onNavigate} leading={<button>Back</button>} trailing={<button>Menu</button>} />);
    const link = screen.getByRole("link", { name: "Lina Reyes" });
    expect(link).toHaveAttribute("href", "/studio/lina");
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
  });
});
