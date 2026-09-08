import { act, fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalProvider, useModal } from "../ModalProvider";

vi.mock("next/dynamic", () => ({
  default: () => function Detail({ isOpen }: { isOpen: boolean }) {
    return isOpen ? <div role="dialog">Open detail</div> : null;
  },
}));

const post = (id: string) => ({
  id, authorId: "creator-id", author: { name: "Creator", handle: "creator", avatar: "" },
  type: "visual" as const, typeLabel: "Visual", timeAgo: "Now", content: "",
  stats: { reactions: 0, comments: 0, relays: 0 },
});

function Controls() {
  const { openPostModal, closePostModal, modalReturnPath } = useModal();
  return <>
    <button onClick={() => openPostModal(post("test-post"))}>Open</button>
    <button onClick={() => openPostModal(post("second-post"))}>Open second</button>
    <button onClick={closePostModal}>Close</button>
    <span data-testid="return">{modalReturnPath ?? "none"}</span>
  </>;
}

afterEach(() => { cleanup(); vi.useRealTimers(); window.history.replaceState({}, "", "/"); });

describe("ModalProvider", () => {
  it("keeps a rapidly reopened detail open after the previous close delay", async () => {
    render(<ModalProvider><Controls /></ModalProvider>);
    fireEvent.click(screen.getByText("Open"));
    fireEvent.click(screen.getByText("Close"));
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Close"));
    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });

  it("pushes one entry on open and pops it on close (no entry left behind)", async () => {
    render(<ModalProvider><Controls /></ModalProvider>);
    fireEvent.click(screen.getByText("Open"));
    expect(window.location.pathname).toBe("/post/test-post");
    expect(window.history.state?.pqModal).toBe("post");
    expect(screen.getByTestId("return").textContent).toBe("/");
    fireEvent.click(screen.getByText("Close"));
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    // Nothing was pushed on close: the entry above us is still the modal's,
    // which the Forward test below proves by re-entering it. (jsdom does not
    // model history.length after back() the way browsers do, so no length
    // assertion here.)
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("return").textContent).toBe("none");
  });

  it("opening a second post while one is open swaps the entry instead of stacking", async () => {
    render(<ModalProvider><Controls /></ModalProvider>);
    fireEvent.click(screen.getByText("Open"));
    const afterFirst = window.history.length;
    fireEvent.click(screen.getByText("Open second"));
    expect(window.location.pathname).toBe("/post/second-post");
    // replaceState, not a second push
    expect(window.history.length).toBe(afterFirst);
    expect(window.history.state?.pqId).toBe("second-post");
    fireEvent.click(screen.getByText("Close"));
    // Back lands on the feed, not on /post/test-post.
    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });

  it("browser Back while open closes the modal", async () => {
    render(<ModalProvider><Controls /></ModalProvider>);
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => { window.history.back(); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.location.pathname).toBe("/");
  });

  it("browser Forward back into the entry reopens the same post", async () => {
    render(<ModalProvider><Controls /></ModalProvider>);
    fireEvent.click(screen.getByText("Open"));
    await act(async () => { window.history.back(); });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await act(async () => { window.history.forward(); });
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(window.location.pathname).toBe("/post/test-post");
  });
});
