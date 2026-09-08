import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Entry = { target: Element; isIntersecting: boolean };
let callbacks: Array<(entries: Entry[]) => void> = [];
let observed: Element[] = [];
let original: typeof IntersectionObserver;

beforeEach(() => {
  callbacks = [];
  observed = [];
  // vitest.setup defines a non-configurable window.IntersectionObserver, so assign rather than stub.
  original = window.IntersectionObserver;
  window.IntersectionObserver = class {
    constructor(cb: (entries: Entry[]) => void) {
      callbacks.push(cb);
    }
    observe(el: Element) {
      observed.push(el);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
  vi.resetModules();
});

afterEach(() => {
  cleanup();
  window.IntersectionObserver = original;
});

describe("LazyVideoThumb (F-25 / V-28)", () => {
  it("attaches src only once the tile comes near the viewport, sharing one observer", async () => {
    const { LazyVideoThumb } = await import("../LazyVideoThumb");
    const { container } = render(
      <>
        <LazyVideoThumb src="/a.mp4" data-testid="a" />
        <LazyVideoThumb src="/b.mp4" data-testid="b" />
      </>,
    );
    const [a, b] = Array.from(container.querySelectorAll("video"));
    expect(a.getAttribute("src")).toBeNull();
    expect(b.getAttribute("src")).toBeNull();
    expect(a.getAttribute("preload")).toBe("metadata");
    expect(callbacks).toHaveLength(1);
    expect(observed).toHaveLength(2);

    act(() => callbacks[0]([{ target: a, isIntersecting: true }]));
    expect(a.getAttribute("src")).toBe("/a.mp4");
    expect(b.getAttribute("src")).toBeNull();
  });
});
