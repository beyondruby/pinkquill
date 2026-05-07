"use client";

import { useEffect, useRef } from "react";

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
 * Reusable confirmation modal matching Quill's branding.
 * Uses purple-primary/pink-vivid gradient for primary actions,
 * solid red for danger actions.
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2100] animate-fadeIn"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />
      {/* Modal */}
      <div
        ref={modalRef}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] max-w-[90vw] bg-surface rounded-2xl shadow-2xl z-[2101] overflow-hidden animate-scaleIn"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-description"
        tabIndex={-1}
      >
        {/* Header accent bar */}
        <div
          className={`h-1 w-full ${
            isDanger
              ? "bg-gradient-to-r from-red-500 to-pink-vivid"
              : "bg-gradient-to-r from-purple-primary to-pink-vivid"
          }`}
        />

        <div className="p-6">
          {/* Icon + Title */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDanger
                  ? "bg-red-50"
                  : "bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10"
              }`}
            >
              {isDanger ? (
                <svg
                  className="w-5 h-5 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-purple-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>
            <h3
              id="confirmation-modal-title"
              className="font-display text-lg font-semibold text-ink"
            >
              {title}
            </h3>
          </div>

          <p
            id="confirmation-modal-description"
            className="font-body text-sm text-muted leading-relaxed mb-6 ml-[52px]"
          >
            {description}
          </p>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-full font-ui text-sm font-medium text-muted hover:text-ink border border-border-light hover:border-border-strong bg-surface hover:bg-subtle transition-all disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`px-5 py-2.5 rounded-full font-ui text-sm font-medium text-white transition-all disabled:opacity-70 flex items-center gap-2 ${
                isDanger
                  ? "bg-red-500 hover:bg-red-600 shadow-sm hover:shadow-md hover:shadow-red-500/20"
                  : "bg-gradient-to-r from-purple-primary to-pink-vivid hover:shadow-lg hover:shadow-pink-vivid/25 hover:scale-[1.02]"
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {isDanger ? "Deleting..." : "Processing..."}
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
