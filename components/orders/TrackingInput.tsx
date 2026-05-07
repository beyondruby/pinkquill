"use client";

import { useState } from "react";
import { useAddTracking } from "@/lib/hooks/useShipping";

const CARRIERS = [
  { value: "", label: "Select carrier" },
  { value: "usps", label: "USPS" },
  { value: "ups", label: "UPS" },
  { value: "fedex", label: "FedEx" },
  { value: "dhl", label: "DHL" },
  { value: "other", label: "Other" },
];

export default function TrackingInput({
  orderId,
  onSuccess,
}: {
  orderId: string;
  onSuccess?: () => void;
}) {
  const { addTracking, adding, error } = useAddTracking();
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim()) return;

    const ok = await addTracking(orderId, trackingNumber.trim(), carrier || undefined);
    if (ok) {
      setSuccess(true);
      onSuccess?.();
    }
  };

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
        <p className="font-ui font-semibold text-emerald-700 text-sm">
          Tracking info added! The buyer has been notified.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border-light bg-surface p-4 space-y-3">
      <h4 className="font-ui font-semibold text-ink text-sm">Add Tracking Information</h4>

      <div className="flex gap-3">
        <select
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border-light bg-surface text-sm font-ui text-ink focus:ring-2 focus:ring-purple-primary/30 focus:border-purple-primary outline-none"
        >
          {CARRIERS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="Tracking number"
          className="flex-1 px-3 py-2 rounded-lg border border-border-light bg-surface text-sm font-ui text-ink placeholder:text-muted focus:ring-2 focus:ring-purple-primary/30 focus:border-purple-primary outline-none"
        />
      </div>

      {error && <p className="text-xs text-red-500 font-body">{error}</p>}

      <button
        type="submit"
        disabled={adding || !trackingNumber.trim()}
        className="w-full py-2.5 rounded-xl text-sm font-ui font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid text-white disabled:opacity-60 hover:opacity-90 transition-opacity"
      >
        {adding ? "Saving..." : "Mark as Shipped"}
      </button>
    </form>
  );
}
