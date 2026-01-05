"use client";

import { useState } from "react";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => Promise<void>;
  submitting: boolean;
  submitted: boolean;
}

const reportReasons = [
  { value: "spam", label: "Spam or misleading" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "violence", label: "Violence or threats" },
  { value: "sexual_content", label: "Inappropriate content" },
  { value: "copyright", label: "Copyright violation" },
  { value: "other", label: "Something else" },
];

export default function ReportModal({ isOpen, onClose, onSubmit, submitting, submitted }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [step, setStep] = useState<"select" | "details">("select");

  if (!isOpen) return null;

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
    setStep("details");
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;
    await onSubmit(selectedReason, details.trim() || undefined);
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDetails("");
    setStep("select");
    onClose();
  };

  const handleBack = () => {
    setStep("select");
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] animate-fadeIn"
        onClick={() => !submitting && handleClose()}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] z-[1001] overflow-hidden animate-scaleIn">
        {submitted ? (
          /* Success State */
          <div className="p-10 text-center">
            <div className="w-14 h-14 bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-display text-[1.5rem] text-ink mb-2">Thank you</h3>
            <p className="font-body text-[0.95rem] text-muted leading-relaxed">
              Your report helps keep our creative community safe.
            </p>
          </div>
        ) : step === "select" ? (
          /* Step 1: Select Reason */
          <>
            {/* Header */}
            <div className="px-6 pt-7 pb-5">
              <h3 className="font-display text-[1.4rem] text-ink mb-1">Report this post</h3>
              <p className="font-body text-[0.9rem] text-muted italic">Your report is anonymous</p>
            </div>

            {/* Reason Options */}
            <div className="px-6 pb-2">
              <div className="space-y-2">
                {reportReasons.map((reason) => (
                  <button
                    key={reason.value}
                    onClick={() => handleReasonSelect(reason.value)}
                    className="w-full flex items-center justify-between px-5 py-4 rounded-xl text-left border border-black/[0.06] transition-all duration-200 hover:border-purple-primary/30 hover:bg-purple-primary/[0.03] group"
                  >
                    <span className="font-ui text-[0.95rem] text-ink group-hover:text-purple-primary transition-colors">
                      {reason.label}
                    </span>
                    <svg className="w-4 h-4 text-muted/40 group-hover:text-purple-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-5">
              <button
                onClick={handleClose}
                className="w-full py-3 font-ui text-[0.9rem] text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          /* Step 2: Add Details */
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 mb-1">
                <button
                  onClick={handleBack}
                  className="w-8 h-8 -ml-1 rounded-full hover:bg-black/[0.04] flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h3 className="font-display text-[1.2rem] text-ink">
                  {reportReasons.find(r => r.value === selectedReason)?.label}
                </h3>
              </div>
              <p className="font-body text-[0.85rem] text-muted italic ml-10">Tell us more (optional)</p>
            </div>

            {/* Details Input */}
            <div className="px-6 pb-4">
              <div className="relative">
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="What's wrong with this post..."
                  maxLength={500}
                  rows={4}
                  className="w-full px-4 py-4 rounded-xl border border-black/[0.08] bg-black/[0.015] font-body text-[0.95rem] text-ink placeholder:text-muted/40 placeholder:italic resize-none focus:outline-none focus:border-purple-primary/40 focus:bg-white transition-all"
                />
                <span className="absolute bottom-3 right-3 font-ui text-[0.7rem] text-muted/50">
                  {details.length}/500
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-5 flex gap-3">
              <button
                onClick={handleBack}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-xl font-ui text-[0.9rem] text-muted border border-black/[0.08] hover:border-black/[0.15] hover:text-ink transition-all disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-xl font-ui text-[0.9rem] font-medium text-white bg-gradient-to-r from-purple-primary to-pink-vivid shadow-md shadow-pink-vivid/20 hover:shadow-lg hover:shadow-pink-vivid/30 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-md flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
