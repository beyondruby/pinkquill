/**
 * Refund execution (Phase 1d). The database decides WHETHER money goes back
 * (refunds.status = 'approved'); this module is the only code that moves it.
 *
 * For each approved refund:
 *   1. if the seller was already paid for the order, reverse the seller's share
 *      of this refund from the transfer first — never refund the buyer while the
 *      seller keeps the money; a failed reversal parks the refund for review
 *   2. create the Stripe refund (idempotent on refund id)
 *   3. record the Stripe ids; charge.refunded then marks it succeeded
 *
 * Called inline by the refund route (so the buyer sees movement immediately)
 * and by the payout worker every 15 minutes (so nothing approved is ever lost).
 */
import { getActiveProvider, TransferBlockedError } from "@/lib/payment-provider";
import { supabaseAdmin } from "@/lib/supabase-server";
import { claimApprovedRefunds, markPayoutReversed, markRefundNeedsReview, markRefundSubmitted } from "@/lib/payments-server";

export interface RefundRunSummary {
  claimed: number;
  submitted: number;
  needs_review: number;
  retry: number;
  errors: string[];
}

export async function executeApprovedRefunds(orderId?: string | null, limit = 25): Promise<RefundRunSummary> {
  const summary: RefundRunSummary = { claimed: 0, submitted: 0, needs_review: 0, retry: 0, errors: [] };
  const refunds = await claimApprovedRefunds(orderId ?? null, limit);
  summary.claimed = refunds.length;
  if (refunds.length === 0) return summary;

  const provider = getActiveProvider();

  for (const refund of refunds) {
    try {
      const { data: payment } = await supabaseAdmin
        .from("payments")
        .select("payment_intent_id, amount_cents, refunded_cents")
        .eq("id", refund.payment_id as string)
        .maybeSingle();
      if (!payment?.payment_intent_id) {
        await markRefundNeedsReview(refund.id, "No PaymentIntent on the payment record");
        summary.needs_review++;
        continue;
      }

      // Seller already paid? Pull their share back first.
      let reversalId: string | null = null;
      let reversalCents = 0;
      if (refund.seller_share_cents > 0) {
        const { data: payout } = await supabaseAdmin
          .from("payouts")
          .select("id, transfer_id, amount_cents, reversed_cents, status")
          .eq("order_id", refund.order_id)
          .eq("status", "sent")
          .maybeSingle();
        if (payout?.transfer_id) {
          const remaining = payout.amount_cents - (payout.reversed_cents ?? 0);
          const toReverse = Math.min(refund.seller_share_cents, Math.max(remaining, 0));
          if (toReverse > 0) {
            try {
              const rev = await provider.reverseTransfer({
                transferId: payout.transfer_id,
                amountCents: toReverse,
                idempotencyKey: `reversal_${refund.id}`,
                metadata: { refund_id: refund.id, order_id: refund.order_id },
              });
              reversalId = rev.reversalId;
              reversalCents = rev.amountCents;
              await markPayoutReversed({
                transferId: payout.transfer_id,
                reversedCents: (payout.reversed_cents ?? 0) + rev.amountCents,
                reason: `refund ${refund.id}`,
              });
            } catch (err) {
              const message = err instanceof Error ? err.message : "Transfer reversal failed";
              await markRefundNeedsReview(refund.id, `Could not reclaim the seller payout: ${message}`);
              summary.needs_review++;
              summary.errors.push(`${refund.id}: ${message}`);
              continue;
            }
          }
        }
      }

      const result = await provider.createRefund({
        paymentIntentId: payment.payment_intent_id,
        amountCents: refund.amount_cents,
        idempotencyKey: `refund_${refund.id}`,
        reason: refund.initiator_role === "buyer" ? "requested_by_customer" : undefined,
        metadata: { refund_id: refund.id, order_id: refund.order_id, kind: refund.kind, initiator: refund.initiator_role },
      });
      await markRefundSubmitted({ refundId: refund.id, stripeRefundId: result.refundId, reversalId, reversalCents });
      summary.submitted++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refund failed";
      const retryable = !(err instanceof TransferBlockedError) && !/already been refunded|charge_already_refunded/i.test(message);
      const outcome = await markRefundNeedsReview(refund.id, message, retryable);
      if (outcome.outcome === "needs_review") summary.needs_review++;
      else summary.retry++;
      summary.errors.push(`${refund.id}: ${message}`);
      console.error(`[refunds] ${refund.id} (order ${refund.order_id}):`, message);
    }
  }
  return summary;
}
