import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalProvider, useModal } from "../ModalProvider";

vi.mock("next/dynamic", () => ({
  default: () => function Detail({ isOpen }: { isOpen: boolean }) {
    return isOpen ? <div role="dialog">Open detail</div> : null;
  },
}));

function Controls() {
  const { openPostModal, closePostModal } = useModal();
  return <>
    <button onClick={() => openPostModal({
      id: "test-post", author: { name: "Creator", handle: "creator", avatar: "" },
      type: "visual", typeLabel: "Visual", timeAgo: "Now", content: "",
      stats: { reactions: 0, comments: 0, relays: 0 },
    })}>Open</button>
    <button onClick={closePostModal}>Close</button>
  </>;
}

afterEach(() => { cleanup(); vi.useRealTimers(); window.history.replaceState({}, "", "/"); });

describe("ModalProvider", () => {
  it("keeps a rapidly reopened detail open after the previous close delay", () => {
    vi.useFakeTimers();
    render(<ModalProvider><Controls /></ModalProvider>);
    fireEvent.click(screen.getByText("Open"));
    fireEvent.click(screen.getByText("Close"));
    fireEvent.click(screen.getByText("Open"));
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Close"));
    expect(window.location.pathname).toBe("/");
  });
});
