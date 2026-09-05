"use client";

import { useRef, type ReactNode } from "react";
import Scrim from "./overlay/Scrim";
import { useOverlayLayer } from "./overlay/useOverlayLayer";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
  /**
   * `wide` (default) is the immersive viewer used by post and take detail:
   * full screen on phones, a large centred stage on desktop.
   * `md` is a regular content dialog that follows the shared dialog sizing.
   */
  size?: "wide" | "md";
}

/**
 * Immersive dialog. Behaviour (Escape ownership, focus containment and return,
 * counted scroll lock) comes from useOverlayLayer; appearance from overlay.css.
 * The old wrapper set aria-hidden on the dialog's own ancestor, which hid the
 * dialog from assistive tech — the scrim is now plain presentation.
 */
export default function Modal({ isOpen, onClose, children, ariaLabel = "Dialog", size = "wide" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useOverlayLayer({ open: isOpen, onClose, containerRef: panelRef });

  if (!isOpen) return null;

  return (
    <Scrim onDismiss={onClose} strong={size === "wide"}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`pq-dialog ${size === "wide" ? "pq-dialog--wide" : "pq-dialog--md"}`}
      >
        {children}
      </div>
    </Scrim>
  );
}
