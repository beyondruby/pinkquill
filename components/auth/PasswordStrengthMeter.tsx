"use client";

import { validatePasswordStrength } from "@/lib/auth/constants";

interface Props {
  password: string;
  /** Smaller variant used inside the AuthModal. */
  compact?: boolean;
}

const LABELS = ["", "Weak", "Fair", "Good", "Strong"] as const;
const BAR_COLORS = [
  "bg-skeleton",
  "bg-red-400",
  "bg-orange-warm",
  "bg-yellow-500",
  "bg-emerald-500",
] as const;

/**
 * Four-bar password strength indicator + the requirement message that
 * `validatePasswordStrength` produced. Hidden until the user has typed
 * something so we don't shout requirements at an empty field.
 */
export default function PasswordStrengthMeter({ password, compact }: Props) {
  if (!password) return null;

  const { score, valid, error } = validatePasswordStrength(password);
  const label = LABELS[score];
  const barH = compact ? "h-1" : "h-1.5";
  const gap = compact ? "gap-1" : "gap-1.5";

  return (
    <div className={compact ? "mt-1.5 space-y-1" : "mt-2 space-y-1.5"}>
      <div className={`flex ${gap}`}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`flex-1 ${barH} rounded-full transition-colors duration-200 ${
              i <= score ? BAR_COLORS[score] : "bg-skeleton"
            }`}
          />
        ))}
      </div>
      <p
        className={`font-ui ${compact ? "text-[0.65rem]" : "text-xs"} ${
          valid ? "text-emerald-600" : "text-muted"
        }`}
      >
        {valid ? `${label} password` : (error ?? "Keep going…")}
      </p>
    </div>
  );
}
