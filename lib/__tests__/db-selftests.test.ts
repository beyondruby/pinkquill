// @vitest-environment node
/**
 * Database contract tests (Phases 1e, 2a, 2c, 2d, 2e). Each calls a SECURITY DEFINER
 * self-test RPC that drives the real RPCs against the real schema and always
 * rolls back. They live in ONE file on purpose: vitest runs files in parallel
 * workers, and the suites lock the same product / listing rows, which
 * deadlocks when they overlap. Tests inside a file run sequentially.
 *
 * Opt-in because they need the service-role key and network:
 *   RUN_DB_SELFTEST=1 npx vitest run lib/__tests__/db-selftests.test.ts
 * Reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the
 * environment or from .env.local.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function envFromDotLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(".env.local")) return out;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const local = envFromDotLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || local.SUPABASE_SERVICE_ROLE_KEY;
const enabled = process.env.RUN_DB_SELFTEST === "1" && Boolean(url && key);

describe.skipIf(!enabled)("money self-test (database contract)", () => {
  it("runs every money path and rolls back", async () => {
    const supabase = createClient(url!, key!, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("run_money_selftest");
    expect(error).toBeNull();
    const result = data as { ok: boolean; rolled_back: boolean; result?: string; error?: string };
    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.rolled_back).toBe(true);

    const out = result.result ?? "";
    // fee model: $5 → 5% seller fee, 3.5% + $0.30 buyer fee
    expect(out).toContain("money5=5.00/0.25/4.75/0.48/5.48");
    expect(out).toContain("money_free=0.00/0");
    // (a) pay, replay, cancel-before-work, Stripe refund closes the books
    expect(out).toContain("a.pay=paid/paid replay=already_processed");
    expect(out).toContain("cancel=cancelled/775");
    expect(out).toContain("refunded=refunded order=cancelled/refunded liab=0 bal=-59");
    // (b) after work started: request → decline → partial approve → partial refund; over-refund refused
    expect(out).toContain("b.cancel=requested decline=declined/in_progress partial_req=279");
    expect(out).toContain("partial=partially_refunded/in_progress/partially_refunded remaining=382 overrefund=refused");
    // (c) overdue buyer cancel
    expect(out).toContain("c.late_cancel=cancelled/true");
    // (d) dispute blocks payout; only admins resolve; paid-out orders cannot be cancelled
    expect(out).toContain("d.released=1 payout=blocked nonadmin=refused resolve=resolved/completed payout=pending cancel_after_payout=refused paid_out_liab=0 paid=661");
    // (e) chargeback lost
    expect(out).toContain("e.created=disputed lost=refunded/refunded");
    // (f) expiry only for the current session; (g) mismatched payment refunded, order still awaiting payment
    expect(out).toContain("f.stale=ignored current=expired");
    expect(out).toContain("g.mismatch=amount_mismatch refund=mismatch_refunded order=pending_payment");
  });
});

describe.skipIf(!enabled)("listing self-test (availability & slots)", () => {
  it("enforces slots, waitlist, closed, scheduled and the seller switch, then rolls back", async () => {
    const supabase = createClient(url!, key!, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("run_listing_selftest");
    expect(error).toBeNull();
    const result = data as { ok: boolean; rolled_back: boolean; result?: string; error?: string };
    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.rolled_back).toBe(true);

    const out = result.result ?? "";
    // (a) first order takes the only slot; due date = lead time + delivery days
    expect(out).toMatch(/a\.status=pending_payment due_days=(\d+) expected=\1 active=1 can_order=false/);
    // (b) the second buyer is refused with the slot reason
    expect(out).toContain("b.second=refused(The only slot is taken right now.)");
    // (c) waitlist: allowed, forced to seller approval, queue position 2
    expect(out).toContain("c.waitlist=pending_acceptance/queued=true/pos=2 slots_used=2");
    // (d) cancelling frees the slot
    expect(out).toContain("d.after_cancel_used=1");
    // (e) closed / future-scheduled / seller not accepting refuse; past-scheduled opens
    expect(out).toContain("e.closed=refused scheduled=refused scheduled_past=pending_payment not_accepting=refused");
    // (f) due date re-based on payment
    expect(out).toMatch(/f\.rebased_days=\d+/);
    expect(out).not.toContain("rebased_days=-");
    // (g) the public RPC agrees with the gate
    expect(out).toContain("g.mode=order");
    expect(out).toContain("accepting=true");
  });
});

describe.skipIf(!enabled)("workroom self-test (intake, references, revisions, deliveries)", () => {
  it("records answers and files, versions deliveries, caps revisions, then rolls back", async () => {
    const supabase = createClient(url!, key!, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("run_workroom_selftest");
    expect(error).toBeNull();
    const result = data as { ok: boolean; rolled_back: boolean; result?: string; error?: string };
    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.rolled_back).toBe(true);

    const out = result.result ?? "";
    // (a) a required question with no answer blocks the request
    expect(out).toContain("a.missing=refused");
    // (b) answers are snapshotted (1 field + legacy notes)
    expect(out).toContain("b.answers=2/A wedding gift");
    // (c) a file path outside the order's folder is refused; a good one is stored
    expect(out).toContain("c.badpath=refused refs=1");
    // (d) an empty delivery is refused; v1 with a file submits and auto-starts the order
    expect(out).toContain("d.empty=refused v1=submitted/started=true");
    // (e) revision 1 flips the order and marks the delivery
    expect(out).toContain("e.rev1=revision_requested/delivery=revision_requested");
    // (f) v2 addresses revision 1 and supersedes v1
    expect(out).toContain("f.v2 rev1=addressed v1=superseded");
    // (g) the revision cap holds; acceptance marks the delivery accepted
    expect(out).toContain("g.rev2=refused accepted=accepted/completed");
    // (h) one read returns everything: 2 answers, 1 reference, 1 revision, 2 deliveries, v1 has 1 file
    expect(out).toContain("h.workroom=2/1/1/2 d1files=1");
  });
});


describe.skipIf(!enabled)("timeline self-test (reminders, extensions)", () => {
  it("fires each reminder once, moves the due date only on accept, then rolls back", async () => {
    const supabase = createClient(url!, key!, { auth: { persistSession: false } });
    const { data, error } = await supabase.rpc("run_timeline_selftest");
    expect(error).toBeNull();
    const result = data as { ok: boolean; rolled_back: boolean; result?: string; error?: string };
    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.rolled_back).toBe(true);

    const out = result.result ?? "";
    // (a) notifications snapshot the recipient's role, money figure and listing title
    expect(out).toContain("a.role=seller has_amount=true has_title=true");
    // (b) -24 h → seller only; due → both; +48 h → both; each rung fires once (1 + 2 + 2 = 5)
    expect(out).toContain("b.soon=1/0 due=1 late=1/0 reminder_notifs=5");
    // (c) only the seller asks; one pending at a time; buyer accepts → date moves, ladder resets
    expect(out).toContain("c.buyer_ask=refused ask=pending/3 second=refused seller_can_ask=false pending=true buyer_can_respond=true accepted=accepted moved=true reminders_reset=true twice=refused");
    // (d) decline keeps the date; withdraw closes the request; 5 extension notifications in total
    expect(out).toContain("d.declined=declined kept=true withdrawn=withdrawn ext_notifs=5");
  });
});

describe.skipIf(!enabled)("seller analytics (read-only shape)", () => {
  it("returns every section with weekly buckets covering the window", async () => {
    const supabase = createClient(url!, key!, { auth: { persistSession: false } });
    const { data: product } = await supabase.from("products").select("seller_id").eq("listing_type", "service").eq("status", "active").limit(1).maybeSingle();
    if (!product) return; // nothing to measure against
    const { data, error } = await supabase.rpc("get_seller_analytics", { p_seller_id: product.seller_id, p_days: 90 });
    expect(error).toBeNull();
    const a = data as Record<string, unknown> & { revenue_by_week: unknown[]; totals: Record<string, number>; conversion: Record<string, unknown> };
    for (const key of ["totals", "previous", "revenue_by_week", "conversion", "on_time", "response", "repeat", "by_listing"]) expect(a).toHaveProperty(key);
    expect(a.window_days).toBe(90);
    // 90 days spans 13 or 14 Monday-aligned weeks
    expect(a.revenue_by_week.length).toBeGreaterThanOrEqual(13);
    expect(a.revenue_by_week.length).toBeLessThanOrEqual(14);
    expect(typeof a.totals.paid_orders).toBe("number");
    expect(a.conversion).toHaveProperty("rate");
  });
});
