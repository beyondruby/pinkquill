// @vitest-environment node
/**
 * Database contract test for availability & slots (Phase 2a).
 *
 * Calls `run_listing_selftest()` — a SECURITY DEFINER RPC that drives
 * create_marketplace_order through the availability gate (slots, waitlist,
 * closed, scheduled, seller switch, due-date re-base) and rolls back.
 *
 * Opt-in, same switch as the money self-test:
 *   RUN_DB_SELFTEST=1 npx vitest run lib/__tests__/listing-selftest.test.ts
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
