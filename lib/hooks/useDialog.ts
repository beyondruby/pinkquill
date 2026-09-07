"use client";

import { useEffect, useRef, type RefObject } from "react";

const dialogs: symbol[] = [];
let previousOverflow = "";
const focusable = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Shared stack for focus, Escape and scroll locking across dialog variants. */
export function useDialog(open: boolean, ref: RefObject<HTMLElement | null>, onClose: () => void, busy = false) {
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => { closeRef.current = onClose; busyRef.current = busy; }, [onClose, busy]);
  useEffect(() => {
    if (!open) return;
    const id = Symbol("dialog");
    const previousFocus = document.activeElement as HTMLElement | null;
    if (!dialogs.length) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialogs.push(id);
    const nodes = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(focusable) ?? [])
      .filter(node => !node.hidden && !node.closest('[hidden], [inert], [aria-hidden="true"]') && node.getClientRects().length > 0);
    // Focus the panel itself (tabindex="-1"), not its first control: after a
    // mouse click Chrome still paints the :focus-visible ring on a control
    // focused from script, which showed up as a purple box around the
    // author's avatar in the post modal. Tab from the panel goes to the
    // first control through the trap below.
    const frame = requestAnimationFrame(() => {
      if (dialogs.at(-1) === id) (ref.current ?? nodes()[0])?.focus({ preventScroll: true });
    });
    const onKey = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!busyRef.current) closeRef.current();
      }
      if (event.key !== "Tab") return;
      const items = nodes();
      const first = items[0];
      const last = items.at(-1);
      if (!first) { event.preventDefault(); ref.current?.focus(); return; }
      const inside = items.some(item => item === document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey, true);
      const wasTop = dialogs.at(-1) === id;
      dialogs.splice(dialogs.indexOf(id), 1);
      if (!dialogs.length) document.body.style.overflow = previousOverflow;
      if (wasTop && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, ref]);
}
