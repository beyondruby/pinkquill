import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ConversationList from "../ConversationList";
import TypingIndicator from "../TypingIndicator";
import type { Conversation } from "../MessagesView";

const person = { id: "p1", username: "poet", display_name: "Poet", avatar_url: null };

const conversations: Conversation[] = [
  {
    id: "c1",
    updated_at: "2026-09-04T13:00:00Z",
    participant: person,
    last_message: { content: "dwadaw", created_at: "2026-09-04T13:00:00Z", sender_id: "p1" },
    unread_count: 12,
  },
  {
    id: "c2",
    updated_at: "2026-09-03T15:00:00Z",
    participant: { ...person, id: "p2", username: "hii", display_name: null },
    last_message: { content: "", created_at: "2026-09-03T15:00:00Z", sender_id: "me", message_type: "voice", voice_duration: 67 },
    unread_count: 0,
  },
  { id: "c3", updated_at: "2026-09-01T00:00:00Z", participant: { ...person, id: "p3", username: "jane" }, last_message: null, unread_count: 0 },
];

describe("ConversationList", () => {
  it("renders one row per person with unread words, the You prefix and the open row marked", () => {
    const onSelect = vi.fn();
    render(<ConversationList conversations={conversations} loading={false} selectedId="c2" currentUserId="me" onSelect={onSelect} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAccessibleName("Poet, 12 unread");
    expect(rows[0].className).toContain("pq-thread-row--unread");
    expect(rows[0]).toHaveTextContent("9+");
    expect(rows[1]).toHaveAttribute("aria-current", "true");
    expect(rows[1]).toHaveTextContent("You: Voice note · 1:07");
    expect(rows[2]).toHaveTextContent("No messages yet");
    fireEvent.click(rows[0]);
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("shows the empty state when there is nothing to list", () => {
    render(<ConversationList conversations={[]} loading={false} selectedId={null} currentUserId="me" onSelect={() => {}} />);
    expect(screen.getByText("No conversations yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("TypingIndicator", () => {
  it("renders nothing without text and a polite status with it", () => {
    const { rerender } = render(<TypingIndicator typingUsers={[]} typingText={null} />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<TypingIndicator typingUsers={[{ user_id: "p1", username: "poet", avatar_url: null } as never]} typingText="poet is typing" />);
    expect(screen.getByRole("status")).toHaveTextContent("poet is typing");
  });
});
