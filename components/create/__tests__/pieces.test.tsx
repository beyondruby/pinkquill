import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ComposerSteps, Disclosure, Switch } from "../pieces";

describe("ComposerSteps", () => {
  it("marks the current step, reports progress, and lets you jump", () => {
    const onSelect = vi.fn();
    render(<ComposerSteps steps={[{ n: 1, label: "Write" }, { n: 2, label: "Format & share" }]} current={2} onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /Format & share/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("progressbar", { name: "Progress" })).toHaveAttribute("aria-valuenow", "100");
    fireEvent.click(screen.getByRole("button", { name: /Write/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});

describe("Disclosure and Switch", () => {
  it("wires expanded state to its panel and toggles a switch", () => {
    const onToggle = vi.fn();
    const { rerender } = render(<Disclosure id="cw" label="Content warning" state="On" open={false} onToggle={onToggle}><p>Body</p></Disclosure>);
    const button = screen.getByRole("button", { name: /Content warning/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Body")).toBeNull();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(<Disclosure id="cw" label="Content warning" open onToggle={onToggle}><p>Body</p></Disclosure>);
    expect(screen.getByText("Body").parentElement).toHaveAttribute("id", "cw-panel");
    expect(button).toHaveAttribute("aria-controls", "cw-panel");

    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Mark as sensitive" />);
    const sw = screen.getByRole("switch", { name: "Mark as sensitive" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
