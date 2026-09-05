"use client";

import { useCallback, useId, useRef, type ReactNode } from "react";
import { CloseIcon } from "./Icons";
import Scrim from "./overlay/Scrim";
import { useOverlayLayer } from "./overlay/useOverlayLayer";

/**
 * Sheet — the focused-task surface for short forms and decisions.
 *
 * Bottom sheet on phones (grabber, rounded top, footer buttons full width),
 * centred dialog from `md` up. Height follows the content up to the dynamic
 * viewport so a phone toolbar never pushes the footer off screen. Anything
 * that needs the whole screen uses `Modal`.
 *
 * Shared behaviour from useOverlayLayer: only the top-most layer answers
 * Escape, Tab stays inside, focus lands on the first field (not the close
 * control) and returns to the trigger on close, page scroll is lock-counted.
 */

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Buttons row. Full-width on phones, trailing on desktop. */
  footer?: ReactNode;
  /** Block closing (backdrop, Esc, X) while a submit is in flight. */
  busy?: boolean;
  ariaLabel?: string;
  /** `tall` keeps a floor height on desktop so multi-step flows don't jump. */
  size?: "md" | "tall";
  /** Extra classes for the scrolling body. */
  bodyClassName?: string;
  /**
   * `sheet` (default): bottom sheet on phones, centred dialog on desktop.
   * `panel`: full-height trailing side panel (notifications), full screen on phones.
   */
  presentation?: "sheet" | "panel";
}

export default function Sheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  busy = false,
  ariaLabel,
  size = "md",
  bodyClassName = "",
  presentation = "sheet",
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const requestClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  useOverlayLayer({ open: isOpen, onClose, containerRef: panelRef, busy });

  if (!isOpen) return null;

  return (
    <Scrim onDismiss={requestClose} className={presentation === "panel" ? "pq-scrim--panel" : ""}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : headingId}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className={`pq-dialog ${presentation === "panel" ? "pq-dialog--panel" : size === "tall" ? "pq-dialog--md" : "pq-dialog--sm"}`}
      >
        {presentation === "sheet" && <div className="pq-dialog__grabber" aria-hidden="true"><span /></div>}
        <div className="pq-dialog__head">
          <div className="pq-dialog__heading">
            <h2 id={headingId} className="pq-dialog__title">{title}</h2>
            {subtitle && <p className="pq-dialog__subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            aria-label="Close"
            data-overlay-close
            className="pq-icon-button pq-icon-button--filled"
          >
            <CloseIcon />
          </button>
        </div>
        <div className={`pq-dialog__body ${bodyClassName}`.trim()}>{children}</div>
        {footer && <div className="pq-dialog__foot">{footer}</div>}
      </div>
    </Scrim>
  );
}
