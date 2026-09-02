/**
 * Server-side wrappers around the money RPCs (docs/commissions/02-plan.md).
 *
 * Every state change caused by a payment event goes through exactly one
 * SECURITY DEFINER RPC; the webhook and routes never write orders.status or
 * payment columns directly. All RPCs here are service_role-only.
 */
import type { PaymentProvider } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase-server";

export interface PaymentMutationResult {
  already_processed: boolean;
  order_id: string;
  status: string;
  payment_status: string;
}

export type PaymentOutcome =
  | "paid"
  | "already_processed"
  | "amount_mismatch"
  | "unexpected_status"
  | "failed"
  | "ignored"
  | "expired"
  | "refunded"
  | "partially_refunded"
  | "mismatch_refunded"
  | "no_payment_record";

export interface PaymentRpcResult {
  outcome: PaymentOutcome;
  payment_id?: string;
  status?: string;
  payment_status?: string;
  expected_cents?: number;
  reason?: string;
  refunded_cents?: number;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(fn, args);
  if (error || data === null || data === undefined) {
    throw new Error(error?.message || `${fn} failed`);
  }
  return data as T;
}

/** Free ($0) orders only — paid orders are recorded from the Stripe webhook. */
export async function finalizeOrderPayment({
  orderId,
  provider,
  paymentReference,
  actorId,
  source,
}: {
  orderId: string;
  provider: PaymentProvider;
  paymentReference: string;
  actorId?: string | null;
  source: string;
}): Promise<PaymentMutationResult> {
  return rpc<PaymentMutationResult>("finalize_order_payment", {
    p_order_id: orderId,
    p_provider: provider,
    p_payment_reference: paymentReference,
    p_actor_id: actorId ?? null,
    p_source: source,
  });
}

/** Returns 'claimed' when this delivery should process the event, 'duplicate' otherwise. */
export async function claimStripeEvent(eventId: string, eventType: string): Promise<"claimed" | "duplicate"> {
  return rpc<"claimed" | "duplicate">("claim_stripe_event", { p_event_id: eventId, p_event_type: eventType });
}

export async function finishStripeEvent(
  eventId: string,
  status: "processed" | "failed" | "ignored",
  error?: string | null,
  orderId?: string | null
): Promise<void> {
  const { error: rpcError } = await supabaseAdmin.rpc("finish_stripe_event", {
    p_event_id: eventId,
    p_status: status,
    p_error: error ?? null,
    p_order_id: orderId ?? null,
  });
  if (rpcError) console.error("[finishStripeEvent]", rpcError.message);
}

export async function recordPaymentSucceeded(args: {
  orderId: string;
  paymentIntentId: string;
  chargeId: string | null;
  checkoutSessionId: string | null;
  amountCents: number;
  currency: string;
  stripeFeeCents: number | null;
  eventId: string;
  source: string;
}): Promise<PaymentRpcResult> {
  return rpc<PaymentRpcResult>("record_payment_succeeded", {
    p_order_id: args.orderId,
    p_payment_intent_id: args.paymentIntentId,
    p_charge_id: args.chargeId,
    p_checkout_session_id: args.checkoutSessionId,
    p_amount_cents: args.amountCents,
    p_currency: args.currency,
    p_stripe_fee_cents: args.stripeFeeCents,
    p_event_id: args.eventId,
    p_source: args.source,
  });
}

export async function recordPaymentFailed(args: {
  orderId: string;
  paymentIntentId: string | null;
  code: string | null;
  message: string | null;
  eventId: string;
}): Promise<PaymentRpcResult> {
  return rpc<PaymentRpcResult>("record_payment_failed", {
    p_order_id: args.orderId,
    p_payment_intent_id: args.paymentIntentId,
    p_code: args.code,
    p_message: args.message,
    p_event_id: args.eventId,
  });
}

export async function recordCheckoutExpired(args: {
  orderId: string;
  checkoutSessionId: string;
  eventId: string;
}): Promise<PaymentRpcResult> {
  return rpc<PaymentRpcResult>("record_checkout_expired", {
    p_order_id: args.orderId,
    p_checkout_session_id: args.checkoutSessionId,
    p_event_id: args.eventId,
  });
}

export async function recordPaymentRefund(args: {
  paymentIntentId: string;
  refundId: string | null;
  refundedCentsTotal: number;
  chargeCents: number;
  reason: string | null;
  eventId: string;
  source: string;
}): Promise<PaymentRpcResult> {
  return rpc<PaymentRpcResult>("record_payment_refund", {
    p_payment_intent_id: args.paymentIntentId,
    p_refund_id: args.refundId,
    p_refunded_cents_total: args.refundedCentsTotal,
    p_charge_cents: args.chargeCents,
    p_reason: args.reason,
    p_event_id: args.eventId,
    p_source: args.source,
  });
}

// ---------------------------------------------------------------------------
// Payouts (Phase 1c)
// ---------------------------------------------------------------------------
export interface PayoutRow {
  id: string;
  order_id: string;
  seller_id: string;
  payment_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  attempts: number;
  source_charge_id: string | null;
  destination_account_id: string | null;
  transfer_id: string | null;
}

export async function releaseEligiblePayouts(): Promise<number> {
  return rpc<number>("release_eligible_payouts", {});
}

export async function claimPendingPayouts(limit: number): Promise<PayoutRow[]> {
  const { data, error } = await supabaseAdmin.rpc("claim_pending_payouts", { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as PayoutRow[];
}

export async function markPayoutSent(args: {
  payoutId: string;
  transferId: string;
  balanceTransactionId: string | null;
  destinationAccountId: string;
}): Promise<void> {
  await rpc("mark_payout_sent", {
    p_payout_id: args.payoutId,
    p_transfer_id: args.transferId,
    p_balance_transaction_id: args.balanceTransactionId,
    p_destination_account_id: args.destinationAccountId,
  });
}

export async function markPayoutFailed(args: {
  payoutId: string;
  error: string;
  block?: boolean;
  blockReason?: string | null;
}): Promise<{ outcome: string }> {
  return rpc<{ outcome: string }>("mark_payout_failed", {
    p_payout_id: args.payoutId,
    p_error: args.error,
    p_block: args.block ?? false,
    p_block_reason: args.blockReason ?? null,
  });
}

export async function markPayoutReversed(args: {
  transferId: string;
  reversedCents: number;
  reason?: string | null;
}): Promise<{ outcome: string }> {
  return rpc<{ outcome: string }>("mark_payout_reversed", {
    p_transfer_id: args.transferId,
    p_reversed_cents: args.reversedCents,
    p_reason: args.reason ?? null,
  });
}

export async function unblockPayoutsForSeller(sellerId: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc("unblock_payouts_for_seller", { p_seller_id: sellerId });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/** Persist the settlement-currency quote on the order before creating the session. */
export async function setOrderCharge(args: {
  orderId: string;
  chargeCurrency: string;
  chargeAmountCents: number;
  chargeFeeCents: number;
  sellerCents: number;
  platformCents: number;
  buyerCents: number;
  fxRate: number;
}): Promise<void> {
  await rpc("set_order_charge", {
    p_order_id: args.orderId,
    p_charge_currency: args.chargeCurrency,
    p_charge_amount_cents: args.chargeAmountCents,
    p_charge_fee_cents: args.chargeFeeCents,
    p_seller_cents: args.sellerCents,
    p_platform_cents: args.platformCents,
    p_buyer_cents: args.buyerCents,
    p_fx_rate: args.fxRate,
  });
}

// ---------------------------------------------------------------------------
// Refunds / disputes / chargebacks (Phase 1d)
// ---------------------------------------------------------------------------
export interface RefundRow {
  id: string;
  order_id: string;
  payment_id: string | null;
  initiator_role: string;
  kind: "full" | "partial";
  amount_cents: number;
  currency: string;
  seller_share_cents: number;
  status: string;
  attempts: number;
  stripe_refund_id: string | null;
}

export async function claimApprovedRefunds(orderId: string | null, limit: number): Promise<RefundRow[]> {
  const { data, error } = await supabaseAdmin.rpc("claim_approved_refunds", { p_order_id: orderId, p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as RefundRow[];
}

export async function markRefundSubmitted(args: {
  refundId: string;
  stripeRefundId: string;
  reversalId?: string | null;
  reversalCents?: number;
}): Promise<void> {
  await rpc("mark_refund_submitted", {
    p_refund_id: args.refundId,
    p_stripe_refund_id: args.stripeRefundId,
    p_reversal_id: args.reversalId ?? null,
    p_reversal_cents: args.reversalCents ?? 0,
  });
}

export async function markRefundNeedsReview(refundId: string, error: string, retryable = false): Promise<{ outcome: string }> {
  return rpc<{ outcome: string }>("mark_refund_needs_review", { p_refund_id: refundId, p_error: error, p_retryable: retryable });
}

export async function recordChargeback(args: {
  paymentIntentId: string;
  stripeDisputeId: string;
  phase: "created" | "updated" | "closed" | "funds_withdrawn" | "funds_reinstated";
  stripeStatus: string;
  reason: string | null;
  amountCents: number;
  currency: string;
  evidenceDueBy: string | null;
  eventId: string;
}): Promise<{ outcome: string; dispute_id?: string; order_status?: string; payout_transfer_id?: string | null; payout_id?: string | null }> {
  return rpc("record_chargeback", {
    p_payment_intent_id: args.paymentIntentId,
    p_stripe_dispute_id: args.stripeDisputeId,
    p_phase: args.phase,
    p_stripe_status: args.stripeStatus,
    p_reason: args.reason,
    p_amount_cents: args.amountCents,
    p_currency: args.currency,
    p_evidence_due_by: args.evidenceDueBy,
    p_event_id: args.eventId,
  });
}

export async function resolveDisputeAsAdmin(args: {
  disputeId: string;
  resolution: string;
  notes?: string | null;
  refundAmount?: number | null;
  adminId: string;
}): Promise<{ outcome: string; status?: string; refund_id?: string | null }> {
  return rpc("resolve_dispute", {
    p_dispute_id: args.disputeId,
    p_resolution: args.resolution,
    p_resolution_notes: args.notes ?? null,
    p_refund_amount: args.refundAmount ?? null,
    p_admin_id: args.adminId,
  });
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}
