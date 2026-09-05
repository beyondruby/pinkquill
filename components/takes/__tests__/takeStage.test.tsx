import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import TakeStage, { formatTakeDuration } from "../TakeStage";

function renderStage(overrides: Partial<Parameters<typeof TakeStage>[0]> = {}) {
  const props = {
    videoRef: createRef<HTMLVideoElement>(),
    src: "/take.mp4",
    poster: null,
    isPlaying: false,
    onTogglePlay: vi.fn(),
    isMuted: true,
    onToggleMute: vi.fn(),
    duration: 75,
    contentWarning: null,
    revealed: true,
    onReveal: vi.fn(),
    ...overrides,
  };
  render(<TakeStage {...props} />);
  return props;
}

describe("TakeStage", () => {
  it("formats the running time", () => {
    expect(formatTakeDuration(75)).toBe("1:15");
    expect(formatTakeDuration(0)).toBe("0:00");
  });

  it("shows play, time and mute over the footage and reports every control", () => {
    const props = renderStage();
    expect(screen.getByText("1:15")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(props.onTogglePlay).toHaveBeenCalledOnce();
    const mute = screen.getByRole("button", { name: "Unmute" });
    expect(mute).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(mute);
    expect(props.onToggleMute).toHaveBeenCalledOnce();
  });

  it("veils a take with a content warning until the viewer chooses to look", () => {
    const props = renderStage({ contentWarning: "Flashing lights", revealed: false });
    expect(screen.getByRole("group", { name: "Content warning" })).toHaveTextContent("Flashing lights");
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show the take" }));
    expect(props.onReveal).toHaveBeenCalledOnce();
  });
});
