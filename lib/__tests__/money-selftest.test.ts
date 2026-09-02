// @vitest-environment node
/**
 * Database contract test for the money state machine (Phase 1e).
 *
 * Calls `run_money_selftest()` — a SECURITY DEFINER RPC that exercises the
 * order/payment/refund/payout/dispute/chargeback RPCs against the real schema
 * and rolls every write back — and asserts on the outcomes it reports.
 *
 * Opt-in because it needs the service-role key and network:
 *   RUN_DB_SELFTEST=1 npx vitest run lib/__tests__/money-selftest.test.ts
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
