"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./Icons";

/**
 * Sheet — the sheet-style modal used by the marketplace screens (Phase 3a).
 *
 * Bottom sheet on phones (drag handle, rounded top), centred dialog
 * from `md` up. Same accessibility contract as `Modal`: role="dialog",
 * aria-modal, Esc closes, Tab is trapped, body scroll locked, focus restored.
 * Keep it for short forms (a note, a few fields, a file picker); anything that
 * needs the whole screen still uses `Modal`. Height follows the content up to
 * 90dvh / 85dvh (see `.sheet-panel` in globals.css); the body scrolls inside.
 */

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Buttons row. Rendered full-width on phones. */
  footer?: ReactNode;
  /** Block closing (backdrop, Esc, X) while a submit is in flight. */
  busy?: boolean;
  ariaLabel?: string;
  /** `tall` is for multi-step flows: keeps a floor height on desktop so steps don't jump. */
  size?: "md" | "tall";
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

let openSheets = 0;

export default function Sheet({ isOpen, onClose, title, subtitle, children, footer, busy = false, ariaLabel, size = "md" }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const requestClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    openSheets += 1;
    if (openSheets === 1) document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const inside = panelRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const raf = requestAnimationFrame(() => {
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      // Skip the close button so the first field gets focus.
      const target = nodes && nodes.length > 1 ? nodes[1] : nodes?.[0];
      (target ?? panelRef.current)?.focus();
    });

    return () => {
      document.removeEventListener("keydown", onKey);
      cancelAnimationFrame(raf);
      openSheets = Math.max(0, openSheets - 1);
      if (openSheets === 0) document.body.style.overflow = "";
      previousFocus.current?.focus?.();
    };
  }, [isOpen, requestClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-(--z-modal) flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={requestClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        tabIndex={-1}
        className={`sheet-panel w-full md:w-[95%] bg-elevated rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col min-h-0 overflow-hidden animate-scaleIn ${
          size === "tall" ? "sheet-panel-tall md:max-w-xl" : "md:max-w-lg"
        }`}
      >
        <div className="md:hidden flex justify-center pt-3">
          <span className="w-10 h-1 rounded-full bg-skeleton" aria-hidden="true" />
        </div>
        <div className="flex items-start justify-between gap-4 px-5 pt-4 md:pt-5">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink leading-tight">{title}</h2>
            {subtitle && <p className="text-sm font-body text-muted mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-subtle text-muted inline-flex items-center justify-center shrink-0 hover:text-ink transition-colors disabled:opacity-50"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 overflow-y-auto overscroll-contain flex-1 min-h-0">{children}</div>
        {footer && (
          <div className="px-5 pb-5 pt-2 flex gap-2 md:justify-end [&>*]:flex-1 md:[&>*]:flex-none">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
