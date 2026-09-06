"use client";

import { useId, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { FieldLabel } from "@/components/create/pieces";

export interface ModerationDecision {
  /** Hours from now; null means no end. */
  hours: number | null;
  reason?: string;
}

interface ModerationSheetProps {
  kind: "mute" | "ban";
  isOpen: boolean;
  targetName: string;
  onClose: () => void;
  onConfirm: (decision: ModerationDecision) => void;
  loading?: boolean;
}

const MUTE_OPTIONS: { label: string; hours: number | "custom" }[] = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
  { label: "Custom", hours: "custom" },
];

const BAN_OPTIONS: { label: string; hours: number | null | "custom" }[] = [
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
  { label: "For good", hours: null },
  { label: "Custom", hours: "custom" },
];

/**
 * Mute or ban, deliberately: how long, why (shown to the person), then one
 * danger button. Same sheet for both so the two never look alike by accident
 * but always work alike. Mount it with a `key` per target so its fields
 * start fresh for each person.
 */
export default function ModerationSheet({ kind, isOpen, targetName, onClose, onConfirm, loading = false }: ModerationSheetProps) {
  const options = kind === "mute" ? MUTE_OPTIONS : BAN_OPTIONS;
  const [choice, setChoice] = useState<number | null | "custom">(kind === "mute" ? 24 : null);
  const [customHours, setCustomHours] = useState("");
  const [reason, setReason] = useState("");
  const reasonId = useId();
  const hoursId = useId();

  const customInvalid = choice === "custom" && !(parseFloat(customHours) > 0);

  const confirm = () => {
    const hours = choice === "custom" ? parseFloat(customHours) : choice;
    onConfirm({ hours, reason: reason.trim() || undefined });
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={kind === "mute" ? `Mute ${targetName}` : `Ban ${targetName}`}
      subtitle={kind === "mute" ? "They stay a member but can't post or comment until it ends." : "They're removed from the community and can't come back until it ends."}
      busy={loading}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={confirm} disabled={customInvalid} loading={loading} loadingText={kind === "mute" ? "Muting…" : "Banning…"}>
            {kind === "mute" ? "Mute" : "Ban"}
          </Button>
        </>
      }
    >
      <div>
        <p className="pq-label">How long</p>
        <div className="pq-chip-row" role="radiogroup" aria-label="How long">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={choice === option.hours}
              className="pq-chip"
              onClick={() => setChoice(option.hours)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {choice === "custom" && (
          <div className="mt-3">
            <FieldLabel htmlFor={hoursId}>Hours</FieldLabel>
            <input id={hoursId} type="number" min="1" className="pq-field pq-field--ui" value={customHours} onChange={(e) => setCustomHours(e.target.value)} placeholder="e.g. 48" />
          </div>
        )}
      </div>
      <div>
        <FieldLabel htmlFor={reasonId} hint="(they will see this)">Reason</FieldLabel>
        <textarea id={reasonId} className="pq-field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === "mute" ? "What they did and what changes when the mute ends." : "What they did. Keep it factual."} />
      </div>
    </Sheet>
  );
}
