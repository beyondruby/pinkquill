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
