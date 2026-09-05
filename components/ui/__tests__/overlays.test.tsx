import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import Modal from "../Modal";
import Sheet from "../Sheet";
import ConfirmationModal from "../ConfirmationModal";
import ActionMenu from "../ActionMenu";
import ReportModal from "../ReportModal";
import { __overlayState } from "../overlay/useOverlayLayer";

const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
const tab = (shift = false) => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab", shiftKey: shift });

beforeEach(() => {
  document.body.style.overflow = "";
});

describe("Modal", () => {
  it("is not hidden from assistive tech, closes on Escape, and returns focus to its trigger", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open work</button>
          <Modal isOpen={open} onClose={() => setOpen(false)} ariaLabel="Work detail">
            <button>Admire</button>
          </Modal>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open work" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Work detail" });
    expect(dialog.closest("[aria-hidden='true']")).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Admire" })).toHaveFocus());
    expect(document.body.style.overflow).toBe("hidden");

    escape();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.body.style.overflow).toBe("");
    expect(trigger).toHaveFocus();
  });

  it("does not close when a press starts inside the dialog and ends on the scrim", () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} ariaLabel="Work detail">
        <p>Long text to select</p>
      </Modal>
    );
    const scrim = screen.getByRole("presentation");
    fireEvent.pointerDown(screen.getByText("Long text to select"));
    fireEvent.click(scrim);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(scrim);
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Sheet", () => {
  it("focuses the first field, not the close control, and contains Tab", async () => {
    render(
      <Sheet isOpen onClose={() => {}} title="Request a revision" footer={<button>Send</button>}>
        <textarea aria-label="Note" />
      </Sheet>
    );
    const note = screen.getByLabelText("Note");
    await waitFor(() => expect(note).toHaveFocus());
    expect(screen.getByRole("dialog", { name: "Request a revision" })).toBeInTheDocument();

    screen.getByRole("button", { name: "Send" }).focus();
    tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    tab(true);
    expect(screen.getByRole("button", { name: "Send" })).toHaveFocus();
  });

  it("blocks Escape and the scrim while busy", () => {
    const onClose = vi.fn();
    render(
      <Sheet isOpen onClose={onClose} title="Sending" busy>
        <p>Working</p>
      </Sheet>
    );
    escape();
    const scrim = screen.getByRole("presentation");
    fireEvent.pointerDown(scrim);
    fireEvent.click(scrim);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });

  it("stacks over a Modal: Escape closes only the top layer and scroll stays locked until the last one closes", async () => {
    function Harness() {
      const [modal, setModal] = useState(true);
      const [sheet, setSheet] = useState(true);
      return (
        <>
          {modal && (
            <Modal isOpen onClose={() => setModal(false)} ariaLabel="Order">
              <button>Approve</button>
            </Modal>
          )}
          {sheet && (
            <Sheet isOpen onClose={() => setSheet(false)} title="Request a revision">
              <textarea aria-label="Note" />
            </Sheet>
          )}
        </>
      );
    }
    render(<Harness />);
    expect(__overlayState().layers).toBe(2);
    expect(document.body.style.overflow).toBe("hidden");

    escape();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Request a revision" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Order" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    escape();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.body.style.overflow).toBe("");
    expect(__overlayState().layers).toBe(0);
  });
});

describe("ConfirmationModal", () => {
  it("starts on the safe choice and blocks dismissal while working", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    const { rerender } = render(
      <ConfirmationModal isOpen onClose={onClose} onConfirm={onConfirm} title="Erase this?" description="It fades for good." confirmText="Erase it" isDanger />
    );
    const dialog = screen.getByRole("alertdialog", { name: "Erase this?" });
    expect(dialog).toHaveAccessibleDescription("It fades for good.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Erase it" }));
    expect(onConfirm).toHaveBeenCalledOnce();

    rerender(
      <ConfirmationModal isOpen onClose={onClose} onConfirm={onConfirm} title="Erase this?" description="It fades for good." confirmText="Erase it" isDanger loading />
    );
    escape();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Erasing..." })).toBeDisabled();
  });
});

describe("ActionMenu", () => {
  it("opens on the first item, moves with arrows, and returns focus to the trigger on Escape", async () => {
    const edit = vi.fn();
    render(
      <ActionMenu
        buttonAriaLabel="Post actions"
        items={[
          { label: "Edit", onSelect: edit },
          { label: "Report", tone: "warning" },
          { label: "Erase", tone: "danger" },
        ]}
      />
    );
    const trigger = screen.getByRole("button", { name: "Post actions" });
    trigger.focus();
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Post actions" });
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus());

    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Report" })).toHaveFocus();
    fireEvent.keyDown(menu, { key: "End" });
    expect(screen.getByRole("menuitem", { name: "Erase" })).toHaveFocus();
    expect(screen.getByRole("menuitem", { name: "Erase" })).toHaveClass("pq-menu__item--danger");

    escape();
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(edit).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("does not close the sheet beneath it when Escape is pressed inside the menu", async () => {
    const closeSheet = vi.fn();
    render(
      <Sheet isOpen onClose={closeSheet} title="Delivery">
        <ActionMenu buttonAriaLabel="Delivery actions" items={[{ label: "Download" }]} />
      </Sheet>
    );
    fireEvent.click(screen.getByRole("button", { name: "Delivery actions" }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Download" })).toHaveFocus());
    escape();
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(closeSheet).not.toHaveBeenCalled();
    escape();
    expect(closeSheet).toHaveBeenCalledOnce();
  });
});

describe("ReportModal", () => {
  it("walks reason → details → submit and keeps the sheet while sending", async () => {
    const onSubmit = vi.fn(async () => {});
    const onClose = vi.fn();
    const { rerender } = render(
      <ReportModal isOpen onClose={onClose} onSubmit={onSubmit} submitting={false} submitted={false} />
    );
    expect(screen.getByRole("dialog", { name: "Report this post" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Harassment/ }));
    expect(screen.getByRole("dialog", { name: "Harassment or bullying" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "Repeated insults in comments" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    });
    expect(onSubmit).toHaveBeenCalledWith("harassment", "Repeated insults in comments");

    rerender(<ReportModal isOpen onClose={onClose} onSubmit={onSubmit} submitting submitted={false} />);
    escape();
    expect(onClose).not.toHaveBeenCalled();

    rerender(<ReportModal isOpen onClose={onClose} onSubmit={onSubmit} submitting={false} submitted />);
    expect(screen.getByRole("dialog", { name: "Thank you" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
