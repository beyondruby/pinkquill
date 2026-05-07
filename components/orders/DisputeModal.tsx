"use client";

import { useState } from "react";
import { useCreateDispute } from "@/lib/hooks/useDisputes";
import type { DisputeReason } from "@/lib/types/store";
import { DISPUTE_REASON_LABELS } from "@/lib/types/store";

interface DisputeModalProps {
  orderId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const REASONS = Object.entries(DISPUTE_REASON_LABELS) as [DisputeReason, string][];

export default function DisputeModal({ orderId, onSuccess, onClose }: DisputeModalProps) {
  const { createDispute, loading, error } = useCreateDispute();
  const [reason, setReason] = useState<DisputeReason | "">("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!reason || !description.trim()) return;
    const result = await createDispute(orderId, reason, description.trim());
    if (result) onSuccess();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-surface rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border-light">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">Open a Dispute</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-skeleton text-muted"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm font-body text-muted mt-1">
            Describe the issue with your order. Both parties will be notified and the order will be paused until resolved.
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          {/* Reason */}
          <div>
            <label className="block text-sm font-ui font-semibold text-ink mb-1.5">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as DisputeReason)}
              className="w-full px-4 py-3 rounded-xl border border-border-light text-sm font-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
            >
              <option value="">Select a reason...</option>
              {REASONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-ui font-semibold text-ink mb-1.5">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the issue in detail. Include any relevant information that can help resolve this dispute..."
              className="w-full px-4 py-3 rounded-xl border border-border-light text-sm font-body text-ink focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 font-body">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-light flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-ui text-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !reason || !description.trim()}
            className="px-5 py-2.5 rounded-xl text-sm font-ui font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
          >
            {loading ? "Opening..." : "Open Dispute"}
          </button>
        </div>
      </div>
    </div>
  );
}
