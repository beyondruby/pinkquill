import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Button from "../Button";

describe("Button behavior during the Pinkquill 2.0 migration", () => {
  it("keeps native submit behavior and prevents submission while pending", () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const view = (loading: boolean) => (
      <form onSubmit={submit}>
        <Button loading={loading} loadingText="Sending…">Send delivery</Button>
      </form>
    );
    const { rerender } = render(view(false));
    fireEvent.click(screen.getByRole("button", { name: "Send delivery" }));
    expect(submit).toHaveBeenCalledTimes(1);
    rerender(view(true));
    const pending = screen.getByRole("button", { name: "Sending…" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("aria-busy", "true");
    fireEvent.click(pending);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("preserves explicit non-submit actions, refs, and accessible expanded state", () => {
    const ref = createRef<HTMLButtonElement>();
    const submit = vi.fn();
    const click = vi.fn();
    render(<form onSubmit={submit}><Button ref={ref} type="button" onClick={click} aria-expanded={false}>More</Button></form>);
    const button = screen.getByRole("button", { name: "More" });
    ref.current?.focus();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(click).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps disabled actions inert after a loading state ends", () => {
    const click = vi.fn();
    const { rerender } = render(<Button disabled loading onClick={click}>Approve delivery</Button>);
    rerender(<Button disabled onClick={click}>Approve delivery</Button>);
    const button = screen.getByRole("button", { name: "Approve delivery" });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");
    fireEvent.click(button);
    expect(click).not.toHaveBeenCalled();
  });

  it("keeps the composer variant and caller styles without forcing a light background", () => {
    render(<Button variant="outline-gradient" className="flex-1" style={{ marginTop: 12 }}>Publish</Button>);
    const button = screen.getByRole("button", { name: "Publish" });
    expect(button).toHaveClass("flex-1");
    expect(button).toHaveStyle({ marginTop: "12px" });
    expect(button.style.background).toBe("");
  });
});
