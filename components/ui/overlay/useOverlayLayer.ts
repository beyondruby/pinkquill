"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Pinkquill 2.0 overlay foundation.
 *
 * One registry for every layered surface (dialogs, sheets, menus, panels) so
 * the app has a single answer for three questions that used to be answered
 * differently by ten components:
 *
 *   1. Who owns Escape?      Only the top-most open layer closes on Escape.
 *   2. Who locks the page?   A counted lock: nested layers never unlock early,
 *                            and the body's previous overflow is restored.
 *   3. Where does focus go?  Into the layer on open (first field, or a named
 *                            element), contained while open, and back to the
 *                            trigger on close.
 *
 * The hook has no visual opinion; overlay.css owns appearance.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

let nextLayerId = 0;
const openLayers: number[] = [];

function pushLayer(id: number) {
  if (!openLayers.includes(id)) openLayers.push(id);
}
function popLayer(id: number) {
  const index = openLayers.indexOf(id);
  if (index !== -1) openLayers.splice(index, 1);
}
function isTopLayer(id: number) {
  return openLayers[openLayers.length - 1] === id;
}

let scrollLocks = 0;
let previousBodyOverflow = "";

export function lockBodyScroll() {
  scrollLocks += 1;
  if (scrollLocks === 1) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}

export function unlockBodyScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = previousBodyOverflow;
}

/** Test-only visibility into the registry; not for product code. */
export function __overlayState() {
  return { layers: openLayers.length, scrollLocks };
}

function isVisible(element: HTMLElement) {
  // Layout-free check so it behaves the same in the browser and under JSDOM.
  return !element.closest("[hidden]") && element.getAttribute("aria-hidden") !== "true";
}

export function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
}

export interface OverlayLayerOptions {
  /** Whether the layer is currently open. */
  open: boolean;
  /** Called when the layer asks to close (Escape). Ignored while `busy`. */
  onClose: () => void;
  /** Element that receives Tab containment and initial focus. */
  containerRef: RefObject<HTMLElement | null>;
  /** Block Escape while a submit is in flight. */
  busy?: boolean;
  /** Lock page scroll while open. Dialogs and sheets do; anchored menus don't. */
  lockScroll?: boolean;
  /** Contain Tab / Shift+Tab inside the container. */
  trapFocus?: boolean;
  /** Move focus into the layer on open. */
  autoFocus?: boolean;
  /**
   * Pick the element that receives initial focus. Default: the first focusable
   * element that is not the close control (`[data-overlay-close]`), otherwise
   * the container itself.
   */
  initialFocus?: () => HTMLElement | null | undefined;
  /** Return focus to the previously focused element on close. */
  returnFocus?: boolean;
}

export function useOverlayLayer({
  open,
  onClose,
  containerRef,
  busy = false,
  lockScroll = true,
  trapFocus = true,
  autoFocus = true,
  initialFocus,
  returnFocus = true,
}: OverlayLayerOptions) {
  const idRef = useRef<number | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const initialFocusRef = useRef(initialFocus);
  onCloseRef.current = onClose;
  busyRef.current = busy;
  initialFocusRef.current = initialFocus;

  // Registration + scroll lock run in a layout effect so a layer opened from a
  // click inside another layer's close handler is ordered correctly.
  useLayoutEffect(() => {
    if (!open) return;
    const id = idRef.current ?? (idRef.current = ++nextLayerId);
    pushLayer(id);
    previousFocus.current = (document.activeElement as HTMLElement | null) ?? null;
    if (lockScroll) lockBodyScroll();

    return () => {
      popLayer(id);
      if (lockScroll) unlockBodyScroll();
      const target = previousFocus.current;
      if (returnFocus && target && typeof target.focus === "function" && document.contains(target)) {
        target.focus({ preventScroll: true });
      }
    };
  }, [open, lockScroll, returnFocus]);

  useEffect(() => {
    if (!open) return;
    const id = idRef.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (id == null || !isTopLayer(id)) return;
      if (event.key === "Escape") {
        if (busyRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !trapFocus) return;
      const container = containerRef.current;
      if (!container) return;
      const nodes = getFocusable(container);
      if (nodes.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && container.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);

    let frame: number | undefined;
    if (autoFocus) {
      frame = window.requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;
        const picked = initialFocusRef.current?.();
        if (picked) {
          picked.focus({ preventScroll: true });
          return;
        }
        const nodes = getFocusable(container);
        const preferred = nodes.find((node) => !node.hasAttribute("data-overlay-close")) ?? nodes[0];
        (preferred ?? container).focus({ preventScroll: true });
      });
    }

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [open, trapFocus, autoFocus, containerRef]);
}
