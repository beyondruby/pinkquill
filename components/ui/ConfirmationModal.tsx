"use client";

import { useId, useRef } from "react";
import Button from "./Button";
import Scrim from "./overlay/Scrim";
import { useOverlayLayer } from "./overlay/useOverlayLayer";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  loading?: boolean;
}

/**
 * A short decision. Focus lands on the safe choice first so a stray Enter
 * never erases anything; Escape and the scrim are blocked while working.
 */
export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDanger = false,
  loading = false,
}: ConfirmationModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const ids = useId();

  useOverlayLayer({
    open: isOpen,
    onClose,
    containerRef: panelRef,
    busy: loading,
    initialFocus: () => cancelRef.current,
  });

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (err) {
      console.error("[ConfirmationModal] Error during confirm:", err);
    }
  };

  return (
    <Scrim onDismiss={loading ? undefined : onClose}>
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-description`}
        aria-busy={loading || undefined}
        tabIndex={-1}
        className="pq-dialog pq-dialog--xs"
      >
        <div className="pq-confirm">
          <span className={`pq-confirm__icon ${isDanger ? "pq-confirm__icon--danger" : ""}`} aria-hidden="true">
            {isDanger ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            )}
          </span>
          <h2 id={`${ids}-title`} className="pq-confirm__title">{title}</h2>
          <p id={`${ids}-description`} className="pq-confirm__text">{description}</p>
        </div>
        <div className="pq-dialog__foot">
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={isDanger ? "danger" : "primary"}
            onClick={handleConfirm}
            loading={loading}
            loadingText={isDanger ? "Erasing..." : "Working..."}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Scrim>
  );
}
