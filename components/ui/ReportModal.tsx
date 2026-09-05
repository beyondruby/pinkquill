"use client";

import { useId, useState } from "react";
import Button from "./Button";
import Sheet from "./Sheet";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => Promise<void>;
  submitting: boolean;
  submitted: boolean;
  title?: string;
  placeholder?: string;
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

const DETAILS_LIMIT = 500;

/**
 * Two short steps on the shared Sheet: pick a reason, then optionally say
 * more. Bottom sheet on phones, centred dialog on desktop; the previous fixed
 * 400px card overflowed narrow phones.
 */
export default function ReportModal({
  isOpen,
  onClose,
  onSubmit,
  submitting,
  submitted,
  title = "Report this post",
  placeholder = "What's wrong with this post...",
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [step, setStep] = useState<"select" | "details">("select");
  const detailsId = useId();

  const reset = () => {
    setSelectedReason(null);
    setDetails("");
    setStep("select");
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason) return;
    await onSubmit(selectedReason, details.trim() || undefined);
  };

  const reasonLabel = reportReasons.find((r) => r.value === selectedReason)?.label ?? "";

  if (submitted) {
    return (
      <Sheet
        isOpen={isOpen}
        onClose={handleClose}
        title="Thank you"
        subtitle="Your report helps keep this a kind place to create."
        footer={<Button onClick={handleClose}>Done</Button>}
      >
        <p className="pq-confirm__text">We look at every report. You won&apos;t hear back unless we need more from you, and the person you reported isn&apos;t told who reported them.</p>
      </Sheet>
    );
  }

  if (step === "details") {
    return (
      <Sheet
        isOpen={isOpen}
        onClose={handleClose}
        busy={submitting}
        title={reasonLabel}
        subtitle="Tell us more (optional). Your report is anonymous."
        footer={
          <>
            <Button variant="secondary" onClick={() => setStep("select")} disabled={submitting}>
              <ChevronLeftIcon size="sm" /> Back
            </Button>
            <Button onClick={handleSubmit} loading={submitting} loadingText="Sending…">
              Send report
            </Button>
          </>
        }
      >
        <div className="grid gap-1.5">
          <label htmlFor={detailsId} className="font-ui text-sm font-semibold text-ink">Details</label>
          <textarea
            id={detailsId}
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, DETAILS_LIMIT))}
            placeholder={placeholder}
            maxLength={DETAILS_LIMIT}
            rows={4}
            className="w-full px-3.5 py-3 rounded-input border border-line bg-surface font-body text-[0.95rem] text-ink placeholder:text-muted resize-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-(--color-action)"
          />
          <span className="justify-self-end font-ui text-xs text-subdued" aria-live="polite">
            {details.length}/{DETAILS_LIMIT}
          </span>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle="Your report is anonymous."
      footer={<Button variant="secondary" onClick={handleClose}>Cancel</Button>}
    >
      <div className="grid gap-2" role="group" aria-label="Reason">
        {reportReasons.map((reason) => (
          <button
            key={reason.value}
            type="button"
            onClick={() => {
              setSelectedReason(reason.value);
              setStep("details");
            }}
            className="pq-choice"
          >
            <span>{reason.label}</span>
            <ChevronRightIcon size="sm" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
