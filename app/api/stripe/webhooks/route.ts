/**
 * Stripe webhook — the only place money facts enter the database.
 *
 * Rules (docs/commissions/02-plan.md, Phase 1b):
 * - Every event is claimed in `stripe_events` before processing and marked
 *   processed / failed / ignored afterwards. Duplicates are acknowledged.
 * - Every state change goes through one SECURITY DEFINER RPC in
 *   lib/payments-server.ts. This file never writes orders.status, payment
 *   columns or notifications directly. Notifications come from the DB
 *   triggers / RPCs (single source).
 * - checkout.session.completed only counts when session.payment_status is
 *   'paid' (Checkout is card-only, but async methods would otherwise mark an
 *   order paid before money exists).
 * - No transfer is ever started from here. Payouts are released by the
 *   completion path (1c).
 * - Wrong-amount / unexpected payments are refunded automatically and
 *   recorded, so a charged buyer is never left without a paid order.
 */
import Stripe from "stripe";
import { NextResponse } from "next/server";
import {
  claimStripeEvent,
  finishStripeEvent,
  markPayoutReversed,
  recordChargeback,
  recordCheckoutExpired,
  recordPaymentFailed,
  recordPaymentRefund,
  recordPaymentSucceeded,
  unblockPayoutsForSeller,
} from "@/lib/payments-server";
import { getStripeServer } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";
import { reportOpsAlert } from "@/lib/ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Outcome = { status: "processed" | "ignored"; note?: string; orderId?: string | null };

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

async function orderIdForPaymentIntent(stripe: Stripe, paymentIntentId: string): Promise<string | null> {
  const { data: payment } = await supabaseAdmin
    .from("payments")
    .select("order_id")
    .eq("payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (payment?.order_id) return payment.order_id as string;
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  return pi.metadata?.order_id || null;
}

/** Charge id + Stripe fee for a succeeded PaymentIntent. */
async function paymentDetails(stripe: Stripe, paymentIntentId: string) {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge.balance_transaction"],
  });
  const charge = pi.latest_charge && typeof pi.latest_charge !== "string" ? pi.latest_charge : null;
  const bt =
    charge?.balance_transaction && typeof charge.balance_transaction !== "string"
      ? charge.balance_transaction
      : null;
  return {
    pi,
    chargeId: charge?.id ?? idOf(pi.latest_charge as string | null) ?? null,
    stripeFeeCents: bt?.fee ?? null,
    amountReceived: pi.amount_received,
    currency: pi.currency,
  };
}

/**
 * Refund a payment we recorded but cannot honour (wrong amount/currency, or the
 * order was no longer awaiting payment). Idempotent per PaymentIntent.
 */
async function refundUnhonouredPayment(
  stripe: Stripe,
  paymentIntentId: string,
  amountCents: number,
  outcome: "amount_mismatch" | "unexpected_status",
  eventId: string
) {
  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      reason: outcome === "unexpected_status" ? "duplicate" : "requested_by_customer",
      metadata: { pinkquill_reason: outcome, stripe_event_id: eventId },
    },
    { idempotencyKey: `refund_unhonoured_${paymentIntentId}` }
  );
  await recordPaymentRefund({
    paymentIntentId,
    refundId: refund.id,
    refundedCentsTotal: refund.amount,
    chargeCents: amountCents,
    reason: outcome,
    eventId,
    source: `stripe.webhook.auto_refund:${eventId}`,
  });
}

async function handleSessionPaid(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  event: Stripe.Event
): Promise<Outcome> {
  const orderId = session.metadata?.order_id || null;
  if (!orderId) return { status: "ignored", note: "no order_id metadata" };

  if (session.payment_status !== "paid") {
    // Delayed-notification method: wait for checkout.session.async_payment_*.
    return { status: "ignored", note: `payment_status=${session.payment_status}`, orderId };
  }

  const paymentIntentId = idOf(session.payment_intent as string | Stripe.PaymentIntent | null);
  if (!paymentIntentId) return { status: "ignored", note: "no payment_intent on session", orderId };

  const details = await paymentDetails(stripe, paymentIntentId);
  const amountCents = session.amount_total ?? details.amountReceived;
  const currency = (session.currency || details.currency || "usd").toLowerCase();

  const result = await recordPaymentSucceeded({
    orderId,
    paymentIntentId,
    chargeId: details.chargeId,
    checkoutSessionId: session.id,
    amountCents,
    currency,
    stripeFeeCents: details.stripeFeeCents,
    eventId: event.id,
    source: `stripe.webhook.${event.type}:${event.id}`,
  });

  if (result.outcome === "amount_mismatch" || result.outcome === "unexpected_status") {
    console.error(
      `[Stripe Webhook] ${result.outcome} on order ${orderId}: charged ${amountCents} ${currency}, expected ${result.expected_cents ?? "n/a"} — refunding`
    );
    await refundUnhonouredPayment(stripe, paymentIntentId, amountCents, result.outcome, event.id);
    await reportOpsAlert({ kind: "unhonoured_payment_refunded", severity: "warning", orderId,
      message: `${result.outcome}: charged ${amountCents} ${currency}, expected ${result.expected_cents ?? "n/a"} — refunded automatically`,
      context: { payment_intent_id: paymentIntentId, stripe_event_id: event.id } });
    return { status: "processed", note: `${result.outcome}; auto-refunded`, orderId };
  }

  return { status: "processed", note: result.outcome, orderId };
}

async function handleSessionExpired(session: Stripe.Checkout.Session, event: Stripe.Event): Promise<Outcome> {
  const orderId = session.metadata?.order_id || null;
  if (!orderId) return { status: "ignored", note: "no order_id metadata" };
  const result = await recordCheckoutExpired({ orderId, checkoutSessionId: session.id, eventId: event.id });
  return { status: "processed", note: `${result.outcome}${result.reason ? ":" + result.reason : ""}`, orderId };
}

async function handleSessionAsyncFailed(session: Stripe.Checkout.Session, event: Stripe.Event): Promise<Outcome> {
  const orderId = session.metadata?.order_id || null;
  if (!orderId) return { status: "ignored", note: "no order_id metadata" };
  const result = await recordPaymentFailed({
    orderId,
    paymentIntentId: idOf(session.payment_intent as string | Stripe.PaymentIntent | null),
    code: "async_payment_failed",
    message: "The payment could not be completed.",
    eventId: event.id,
  });
  return { status: "processed", note: result.outcome, orderId };
}

async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent, event: Stripe.Event): Promise<Outcome> {
  const orderId = pi.metadata?.order_id || null;
  if (!orderId) return { status: "ignored", note: "no order_id metadata" };
  const err = pi.last_payment_error;
  const result = await recordPaymentFailed({
    orderId,
    paymentIntentId: pi.id,
    code: err?.decline_code || err?.code || "payment_failed",
    message: err?.message || null,
    eventId: event.id,
  });
  return { status: "processed", note: result.outcome, orderId };
}

async function handleChargeRefunded(stripe: Stripe, charge: Stripe.Charge, event: Stripe.Event): Promise<Outcome> {
  const paymentIntentId = idOf(charge.payment_intent as string | Stripe.PaymentIntent | null);
  if (!paymentIntentId) return { status: "ignored", note: "charge has no payment_intent" };

  const orderId = await orderIdForPaymentIntent(stripe, paymentIntentId);
  const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 1 });
  const latest = refunds.data[0];

  const result = await recordPaymentRefund({
    paymentIntentId,
    refundId: latest?.id ?? null,
    refundedCentsTotal: charge.amount_refunded,
    chargeCents: charge.amount,
    reason: latest?.reason ?? null,
    eventId: event.id,
    source: `stripe.webhook.charge_refunded:${event.id}`,
  });

  if (result.outcome === "no_payment_record") {
    return { status: "ignored", note: "refund for a charge with no payments row", orderId };
  }

  // Full refund after the seller was already paid: pull the transfer back.
  // Partial reversals and the no-balance case are handled in 1d.
  if (orderId && result.outcome === "refunded") {
    const { data: payout } = await supabaseAdmin
      .from("payouts")
      .select("id, transfer_id, amount_cents, reversed_cents, status")
      .eq("order_id", orderId)
      .maybeSingle();
    if (payout?.transfer_id && payout.status === "sent") {
      try {
        const reversal = await stripe.transfers.createReversal(
          payout.transfer_id,
          { metadata: { order_id: orderId, reason: "refund", stripe_event_id: event.id } },
          { idempotencyKey: `reversal_${payout.id}` }
        );
        await markPayoutReversed({
          transferId: payout.transfer_id,
          reversedCents: (payout.reversed_cents ?? 0) + reversal.amount,
          reason: "refund",
        });
      } catch (err) {
        console.error("[Stripe Webhook] Transfer reversal failed:", err);
        await supabaseAdmin.from("order_events").insert({
          order_id: orderId,
          event_type: "transfer_failed",
          metadata: { action: "reversal_failed", transfer_id: payout.transfer_id, stripe_event_id: event.id,
            error: err instanceof Error ? err.message : "Unknown" },
        });
      }
    }
  }

  return { status: "processed", note: result.outcome, orderId };
}

/** Chargebacks (card-network disputes): freeze the order, hold/reclaim the payout, track the outcome. */
async function handleDispute(stripe: Stripe, dispute: Stripe.Dispute, event: Stripe.Event): Promise<Outcome> {
  const paymentIntentId = idOf(dispute.payment_intent as string | Stripe.PaymentIntent | null);
  if (!paymentIntentId) return { status: "ignored", note: "dispute without payment_intent" };
  const phase = event.type.replace("charge.dispute.", "") as "created" | "updated" | "closed" | "funds_withdrawn" | "funds_reinstated";

  const result = await recordChargeback({
    paymentIntentId,
    stripeDisputeId: dispute.id,
    phase,
    stripeStatus: dispute.status,
    reason: dispute.reason ?? null,
    amountCents: dispute.amount,
    currency: dispute.currency,
    evidenceDueBy: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
    eventId: event.id,
  });
  if (result.outcome === "no_payment_record") return { status: "ignored", note: "chargeback for unknown payment" };

  // If the seller was already paid, reclaim the payout while the case is open.
  if (phase === "created" && result.payout_transfer_id) {
    try {
      const reversal = await stripe.transfers.createReversal(
        result.payout_transfer_id,
        { metadata: { reason: "chargeback", stripe_dispute_id: dispute.id, stripe_event_id: event.id } },
        { idempotencyKey: `reversal_chargeback_${dispute.id}` }
      );
      await markPayoutReversed({ transferId: result.payout_transfer_id, reversedCents: reversal.amount, reason: `chargeback ${dispute.id}` });
    } catch (err) {
      console.error("[Stripe Webhook] chargeback payout reversal failed:", err);
      const orderId = (await orderIdForPaymentIntent(stripe, paymentIntentId)) ?? undefined;
      if (orderId) {
        await supabaseAdmin.from("order_events").insert({
          order_id: orderId, event_type: "transfer_failed",
          metadata: { action: "reversal_failed", reason: "chargeback", transfer_id: result.payout_transfer_id, stripe_dispute_id: dispute.id,
            error: err instanceof Error ? err.message : "Unknown" },
        });
      }
    }
  }
  console.error(`[Stripe Webhook] chargeback ${phase} (${dispute.id}, ${dispute.status})`);
  if (phase === "created") {
    await reportOpsAlert({ kind: "chargeback_opened", severity: "critical",
      message: `Chargeback ${dispute.id} (${dispute.reason ?? "unknown"}) for ${dispute.amount} ${dispute.currency} — respond in Stripe`,
      context: { stripe_dispute_id: dispute.id, payment_intent_id: paymentIntentId, evidence_due_by: dispute.evidence_details?.due_by ?? null } });
  }
  return { status: "processed", note: `chargeback ${phase} → ${result.order_status ?? ""}`, orderId: null };
}

async function handleTransferReversed(transfer: Stripe.Transfer, event: Stripe.Event): Promise<Outcome> {
  const result = await markPayoutReversed({
    transferId: transfer.id,
    reversedCents: transfer.amount_reversed,
    reason: `stripe:${event.type}`,
  });
  if (result.outcome === "no_payout") return { status: "ignored", note: "reversal for unknown transfer" };
  return { status: "processed", note: result.outcome };
}

async function handlePayoutFailed(payout: Stripe.Payout, event: Stripe.Event): Promise<Outcome> {
  const accountId = event.account || null;
  if (!accountId) return { status: "ignored", note: "platform payout (not a connected account)" };
  const { data: seller } = await supabaseAdmin
    .from("seller_accounts")
    .select("user_id")
    .eq("stripe_account_id", accountId)
    .maybeSingle();
  if (!seller) return { status: "ignored", note: "payout for unknown connected account" };
  await supabaseAdmin.from("notifications").insert({
    user_id: seller.user_id,
    actor_id: seller.user_id,
    type: "order_transfer_failed",
    content: `A payout to your bank account failed${payout.failure_message ? `: ${payout.failure_message}` : ""}. Check your payout details in the Stripe dashboard.`,
  });
  return { status: "processed", note: payout.failure_code ?? undefined };
}

async function handleAccountUpdated(account: Stripe.Account): Promise<Outcome> {
  const { data: sellerAccount } = await supabaseAdmin
    .from("seller_accounts")
    .select("id, user_id, payouts_enabled")
    .eq("stripe_account_id", account.id)
    .maybeSingle();
  if (!sellerAccount) return { status: "ignored", note: "unknown connected account" };

  const wasPayoutsEnabled = sellerAccount.payouts_enabled;
  await supabaseAdmin
    .from("seller_accounts")
    .update({
      onboarding_complete: account.details_submitted ?? false,
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      country: account.country || null,
      requirements_currently_due: account.requirements?.currently_due ?? [],
      disabled_reason: account.requirements?.disabled_reason ?? null,
      requirements_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sellerAccount.id);

  // Seller just became payable: blocked payouts go back to the queue.
  if (!wasPayoutsEnabled && account.payouts_enabled) {
    const n = await unblockPayoutsForSeller(sellerAccount.user_id);
    if (n > 0) console.log(`[Stripe Webhook] unblocked ${n} payout(s) for ${sellerAccount.user_id}`);
  }
  return { status: "processed" };
}

async function handleAccountDeauthorized(event: Stripe.Event): Promise<Outcome> {
  const accountId = event.account || null;
  if (!accountId) return { status: "ignored", note: "no account on event" };
  await supabaseAdmin
    .from("seller_accounts")
    .update({
      charges_enabled: false,
      payouts_enabled: false,
      disabled_reason: "deauthorized",
      requirements_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", accountId);
  return { status: "processed" };
}

/**
 * Signing secrets to try, in order. Stripe issues one secret per event
 * destination and the platform needs two destinations (events from "Your
 * account" and events from "Connected accounts"), so both
 * STRIPE_WEBHOOK_SECRET and STRIPE_CONNECT_WEBHOOK_SECRET are accepted, and
 * either may hold a comma-separated list (useful while rolling a secret).
 */
function webhookSecrets(): string[] {
  return [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET]
    .flatMap((v) => (v ? v.split(",") : []))
    .map((v) => v.trim())
    .filter(Boolean);
}

function constructEvent(stripe: Stripe, payload: string, signature: string, secrets: string[]): Stripe.Event {
  let lastError: unknown;
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Invalid webhook signature");
}

export async function POST(request: Request) {
  const secrets = webhookSecrets();
  if (secrets.length === 0) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripeServer();

  let event: Stripe.Event;
  try {
    event = constructEvent(stripe, payload, signature, secrets);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const claim = await claimStripeEvent(event.id, event.type);
  if (claim !== "claimed") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  let outcome: Outcome;
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        outcome = await handleSessionPaid(stripe, event.data.object as Stripe.Checkout.Session, event);
        break;
      case "checkout.session.async_payment_failed":
        outcome = await handleSessionAsyncFailed(event.data.object as Stripe.Checkout.Session, event);
        break;
      case "checkout.session.expired":
        outcome = await handleSessionExpired(event.data.object as Stripe.Checkout.Session, event);
        break;
      case "payment_intent.payment_failed":
        outcome = await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent, event);
        break;
      case "charge.refunded":
        outcome = await handleChargeRefunded(stripe, event.data.object as Stripe.Charge, event);
        break;
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
      case "charge.dispute.funds_withdrawn":
      case "charge.dispute.funds_reinstated":
        outcome = await handleDispute(stripe, event.data.object as Stripe.Dispute, event);
        break;
      case "transfer.reversed":
        outcome = await handleTransferReversed(event.data.object as Stripe.Transfer, event);
        break;
      case "payout.failed":
        outcome = await handlePayoutFailed(event.data.object as Stripe.Payout, event);
        break;
      case "account.updated":
        outcome = await handleAccountUpdated(event.data.object as Stripe.Account);
        break;
      case "account.application.deauthorized":
        outcome = await handleAccountDeauthorized(event);
        break;
      default:
        outcome = { status: "ignored", note: "unhandled event type" };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    console.error(`[Stripe Webhook] ${event.type} ${event.id} failed:`, error);
    await finishStripeEvent(event.id, "failed", message);
    await reportOpsAlert({ kind: "webhook_failed", message: `${event.type} ${event.id}: ${message}`, context: { event_type: event.type, event_id: event.id } });
    // 500 → Stripe retries; claim_stripe_event lets the retry through.
    return NextResponse.json({ error: message }, { status: 500 });
  }

  await finishStripeEvent(event.id, outcome.status, outcome.note ?? null, outcome.orderId ?? null);
  return NextResponse.json({ received: true, outcome: outcome.status, note: outcome.note });
}
