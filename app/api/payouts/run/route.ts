/**
 * Payout worker — the only code path that moves money to sellers.
 *
 * Called on a schedule by pg_cron (run_cron_job('payout_worker') → pg_net POST
 * with the cron secret) and available to operators. Each run:
 *   1. releases newly eligible payouts (7-day hold, verified payment, no open
 *      dispute/chargeback) — release_eligible_payouts()
 *   2. claims pending payouts (FOR UPDATE SKIP LOCKED) — claim_pending_payouts()
 *   3. for each, creates ONE Stripe transfer (idempotent on payout id) and
 *      records the outcome — mark_payout_sent / mark_payout_failed
 *
 * A seller without a payable Stripe account blocks their payout (unblocked by
 * account.updated). Transient Stripe errors retry with backoff; after
 * payout_max_attempts the payout is marked failed for review.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyCronSecret } from "@/lib/api-security";
import { getActiveProvider, TransferBlockedError } from "@/lib/payment-provider";
import {
  claimPendingPayouts,
  markPayoutFailed,
  markPayoutSent,
  releaseEligiblePayouts,
} from "@/lib/payments-server";
import { executeApprovedRefunds } from "@/lib/refunds-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SellerAccountRow {
  user_id: string;
  stripe_account_id: string | null;
  payouts_enabled: boolean;
  disabled_reason: string | null;
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (!verifyCronSecret(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = {
    released: 0, claimed: 0, sent: 0, blocked: 0, retry: 0, failed: 0, errors: [] as string[],
    refunds: { claimed: 0, submitted: 0, needs_review: 0, retry: 0, errors: [] as string[] },
  };

  try {
    // Money going back to buyers first (approved refunds), then money to sellers.
    summary.refunds = await executeApprovedRefunds(null, 25);
    summary.released = await releaseEligiblePayouts();

    const { data: batchSetting } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "payout_batch_size")
      .maybeSingle();
    const batchSize = Math.max(1, Math.min(100, Number(batchSetting?.value ?? 25) || 25));

    const payouts = await claimPendingPayouts(batchSize);
    summary.claimed = payouts.length;
    if (payouts.length === 0) {
      return NextResponse.json({ ok: true, ...summary });
    }

    const sellerIds = [...new Set(payouts.map((p) => p.seller_id))];
    const { data: accounts } = await supabaseAdmin
      .from("seller_accounts")
      .select("user_id, stripe_account_id, payouts_enabled, disabled_reason")
      .in("user_id", sellerIds);
    const accountBySeller = new Map<string, SellerAccountRow>(
      ((accounts ?? []) as SellerAccountRow[]).map((a) => [a.user_id, a])
    );

    const provider = getActiveProvider();

    for (const payout of payouts) {
      const account = accountBySeller.get(payout.seller_id);
      if (!account?.stripe_account_id) {
        await markPayoutFailed({ payoutId: payout.id, error: "Seller has no Stripe account", block: true, blockReason: "no_stripe_account" });
        summary.blocked++;
        continue;
      }
      if (!account.payouts_enabled) {
        await markPayoutFailed({
          payoutId: payout.id,
          error: `Seller payouts disabled${account.disabled_reason ? ` (${account.disabled_reason})` : ""}`,
          block: true,
          blockReason: account.disabled_reason || "payouts_disabled",
        });
        summary.blocked++;
        continue;
      }

      try {
        const transfer = await provider.createTransfer({
          payoutId: payout.id,
          orderId: payout.order_id,
          amountCents: payout.amount_cents,
          currency: payout.currency,
          destinationAccountId: account.stripe_account_id,
          sourceChargeId: payout.source_charge_id,
        });
        await markPayoutSent({
          payoutId: payout.id,
          transferId: transfer.transferId,
          balanceTransactionId: transfer.balanceTransactionId,
          destinationAccountId: account.stripe_account_id,
        });
        summary.sent++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Transfer failed";
        if (err instanceof TransferBlockedError) {
          await markPayoutFailed({ payoutId: payout.id, error: message, block: true, blockReason: err.reason });
          summary.blocked++;
        } else {
          const result = await markPayoutFailed({ payoutId: payout.id, error: message });
          if (result.outcome === "failed") summary.failed++;
          else summary.retry++;
        }
        summary.errors.push(`${payout.id}: ${message}`);
        console.error(`[payouts/run] payout ${payout.id} (order ${payout.order_id}):`, message);
      }
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payout run failed";
    console.error("[payouts/run]", err);
    return NextResponse.json({ ok: false, error: message, ...summary }, { status: 500 });
  }
}
