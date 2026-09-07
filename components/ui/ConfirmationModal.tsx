"use client";

import { useEffect, useRef } from "react";
import Button from "./Button";

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
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
      modalRef.current?.focus();
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose, loading]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (err) {
      console.error("[ConfirmationModal] Error during confirm:", err);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-(--z-modal) animate-fadeIn"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-w-[90vw] bg-surface rounded-3xl shadow-2xl border border-border-light z-(--z-modal) overflow-hidden animate-scaleIn"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-description"
        tabIndex={-1}
      >
        <div className="p-7">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                isDanger
                  ? "bg-red-50 text-red-500"
                  : "bg-purple-50 text-purple-primary"
              }`}
            >
              {isDanger ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                </svg>
              )}
            </div>
            <h3
              id="confirmation-modal-title"
              className="font-display text-xl text-ink leading-tight"
            >
              {title}
            </h3>
          </div>

          <p
            id="confirmation-modal-description"
            className="font-body text-[0.95rem] text-muted leading-relaxed mb-7 ml-[56px]"
          >
            {description}
          </p>

          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
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
      </div>
    </>
  );
}
