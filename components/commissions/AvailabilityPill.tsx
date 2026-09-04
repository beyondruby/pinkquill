import type { CommissionListing } from "@/lib/types/store";

/**
 * Compact availability state for cards and headers (Phase 2a).
 * Reads the listing row only (slots_used is trigger-maintained); the detail
 * page uses the live RPC which also folds in the seller-level switch.
 */
export function describeAvailability(listing: CommissionListing | null | undefined, sellerAccepting = true): {
  label: string;
  tone: "open" | "limited" | "waitlist" | "closed";
} {
  if (!sellerAccepting) return { label: "Not taking orders", tone: "closed" };
  if (!listing) return { label: "Open", tone: "open" };

  if (listing.availability === "closed") return { label: "Closed", tone: "closed" };
  if (listing.availability === "scheduled") {
    const opens = listing.opens_at ? new Date(listing.opens_at) : null;
    if (opens && opens.getTime() > Date.now()) {
      return {
        label: `Opens ${opens.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
        tone: "closed",
      };
    }
  }
  if (listing.availability === "waitlist") return { label: "Waitlist", tone: "waitlist" };

  if (listing.slots_total !== null && listing.slots_total !== undefined) {
    const open = Math.max(listing.slots_total - (listing.slots_used ?? 0), 0);
    if (open === 0) return { label: "Slots full", tone: "closed" };
    return { label: `${open} of ${listing.slots_total} slots open`, tone: open === 1 ? "limited" : "open" };
  }
  return { label: "Open", tone: "open" };
}

const TONE_CLASSES: Record<ReturnType<typeof describeAvailability>["tone"], string> = {
  open: "bg-emerald-50 text-emerald-700 border-emerald-200",
  limited: "bg-amber-50 text-amber-700 border-amber-200",
  waitlist: "bg-purple-50 text-purple-700 border-purple-200",
  closed: "bg-subtle text-muted border-border-light",
};

export default function AvailabilityPill({
  listing,
  sellerAccepting = true,
  className = "",
}: {
  listing: CommissionListing | null | undefined;
  sellerAccepting?: boolean;
  className?: string;
}) {
  const { label, tone } = describeAvailability(listing, sellerAccepting);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-ui font-semibold ${TONE_CLASSES[tone]} ${className}`}
    >
      {label}
    </span>
  );
}
