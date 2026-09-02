/**
 * Stripe Provider — Platform-Centric Payment Architecture
 *
 * All payments are processed through the PLATFORM's Stripe account.
 * Sellers receive payouts via Stripe Transfers after order fulfillment.
 * Seller Connect accounts are for payouts only — their status never blocks payments.
 *
 * - Checkout: Stripe Checkout Sessions (embedded mode)
 * - Payouts: Stripe Transfers to seller's Connect Express account
 * - Escrow: Funds held in platform balance until transfer
 * - Refunds: stripe.refunds.create() + transfer reversal if needed
 */

import Stripe from "stripe";
import {
  TransferBlockedError,
  type PaymentProviderInterface,
  type OnboardingResult,
  type SellerStatusResult,
  type DashboardResult,
  type CheckoutSessionResult,
  type TransferRequest,
  type TransferResult,
  type RefundRequest,
  type RefundResult,
  type ReversalRequest,
  type ReversalResult,
  type OrderForCheckout,
} from "@/lib/payment-provider";
import { getStripeServer, CONNECT_ACCOUNT_TYPE } from "@/lib/stripe";
import { PLATFORM_COUNTRY } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase-server";

// ============================================================================
// HELPERS
// ============================================================================

function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://www.pinkquill.com"
      : "http://localhost:3000")
  );
}

function normalizeDescriptorSuffix(
  orderNumber: string | null | undefined
): string | undefined {
  const fallback = String(orderNumber || "").trim();
  let suffix = (fallback || "PINKQUILL")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (!/[A-Z]/.test(suffix)) {
    suffix = `${suffix} PQ`.trim();
  }

  suffix = suffix.slice(-12).trim();
  if (!suffix || !/[A-Z]/.test(suffix)) {
    return "PINKQUILL";
  }

  return suffix;
}

const REQUESTED_CONNECT_CAPABILITIES: Stripe.AccountCreateParams.Capabilities = {
  transfers: { requested: true },
};

// ============================================================================
// STRIPE PROVIDER
// ============================================================================

export class StripeProvider implements PaymentProviderInterface {
  readonly name = "stripe" as const;

  // ============================================================================
  // SELLER ONBOARDING — For payouts only
  // ============================================================================

  async createSellerAccount(
    userId: string,
    email: string,
    profile: { username?: string; displayName?: string },
    country: string
  ): Promise<OnboardingResult> {
    const stripe = getStripeServer();
    const countryCode = country.toUpperCase();
    // Non-Canadian sellers are paid through Stripe's cross-border payouts,
    // which requires the "recipient" service agreement (transfers only).
    const serviceAgreement = countryCode === PLATFORM_COUNTRY ? "full" : "recipient";

    const { data: existing } = await supabaseAdmin
      .from("seller_accounts")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    let stripeAccountId = existing?.stripe_account_id as string | null | undefined;

    if (!stripeAccountId) {
      let account: Stripe.Account;
      try {
        account = await stripe.accounts.create(
          {
            type: CONNECT_ACCOUNT_TYPE,
            country: countryCode,
            email,
            metadata: { user_id: userId, username: profile.username || "" },
            business_profile: { name: profile.displayName || profile.username || undefined },
            capabilities: REQUESTED_CONNECT_CAPABILITIES,
            ...(serviceAgreement === "recipient"
              ? { tos_acceptance: { service_agreement: "recipient" } }
              : {}),
          },
          // Never create two accounts for one seller on a double click.
          { idempotencyKey: `connect_account_${userId}_${countryCode}` }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stripe rejected the account";
        if (/country|service_agreement|not supported|unsupported/i.test(message)) {
          throw new TransferBlockedError(
            "country_not_supported",
            "Payouts aren't available in your country yet. We're working on it."
          );
        }
        throw err;
      }
      stripeAccountId = account.id;

      await supabaseAdmin.from("seller_accounts").upsert(
        {
          user_id: userId,
          stripe_account_id: stripeAccountId,
          country: countryCode,
          service_agreement: serviceAgreement,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    const origin = getSiteUrl();
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${origin}/seller/onboarding?refresh=true`,
      return_url: `${origin}/seller/onboarding?success=true`,
      type: "account_onboarding",
    });

    return { url: accountLink.url, accountId: stripeAccountId };
  }

  async checkSellerStatus(userId: string): Promise<SellerStatusResult> {
    const { data: account } = await supabaseAdmin
      .from("seller_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!account) {
      return {
        provider: "stripe",
        hasAccount: false,
        accountId: null,
        onboardingComplete: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        country: null,
        email: null,
      };
    }

    if (account.stripe_account_id) {
      const stripe = getStripeServer();
      const stripeAccount = await stripe.accounts.retrieve(
        account.stripe_account_id
      );

      const updates = {
        onboarding_complete: stripeAccount.details_submitted ?? false,
        charges_enabled: stripeAccount.charges_enabled ?? false,
        payouts_enabled: stripeAccount.payouts_enabled ?? false,
        country: stripeAccount.country || account.country,
        updated_at: new Date().toISOString(),
      };

      await supabaseAdmin
        .from("seller_accounts")
        .update(updates)
        .eq("id", account.id);

      return {
        provider: "stripe",
        hasAccount: true,
        accountId: account.stripe_account_id,
        onboardingComplete: updates.onboarding_complete,
        chargesEnabled: updates.charges_enabled,
        payoutsEnabled: updates.payouts_enabled,
        country: updates.country || null,
        email: null,
      };
    }

    return {
      provider: "stripe",
      hasAccount: true,
      accountId: null,
      onboardingComplete: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      country: account.country || null,
      email: null,
    };
  }

  async getSellerDashboardUrl(userId: string): Promise<DashboardResult> {
    const { data: account } = await supabaseAdmin
      .from("seller_accounts")
      .select("stripe_account_id")
      .eq("user_id", userId)
      .single();

    if (!account?.stripe_account_id) {
      const origin = getSiteUrl();
      return { url: `${origin}/seller/onboarding` };
    }

    const stripe = getStripeServer();
    const loginLink = await stripe.accounts.createLoginLink(
      account.stripe_account_id
    );
    return { url: loginLink.url };
  }

  // ============================================================================
  // CHECKOUT — Stripe Checkout Session (Embedded Mode)
  // All payments go through the PLATFORM's account. No destination charges.
  // ============================================================================

  async createCheckoutSession(
    order: OrderForCheckout
  ): Promise<CheckoutSessionResult> {
    const stripe = getStripeServer();
    // Charge in the settlement currency when a quote is attached (USD listing,
    // CAD charge today); otherwise in the listing currency.
    const listingTotalCents = Math.round(order.amount * 100) + Math.round((order.buyerFee || 0) * 100);
    const buyerFeeCents = order.charge ? order.charge.feeCents : Math.round((order.buyerFee || 0) * 100);
    const totalCents = order.charge ? order.charge.amountCents : listingTotalCents;
    const amountCents = totalCents - buyerFeeCents;
    const currency = (order.charge?.currency || order.currency || "usd").toLowerCase();
    const listingCurrency = (order.currency || "usd").toUpperCase();
    const convertedNote = order.charge && order.charge.currency.toLowerCase() !== listingCurrency.toLowerCase()
      ? ` (${listingCurrency} ${(listingTotalCents / 100).toFixed(2)} at ${order.charge.rate.toFixed(4)} ${listingCurrency}/${order.charge.currency.toUpperCase()})`
      : "";
    const orderReference = order.orderNumber || order.id;
    const compactTitle = String(order.productTitle || "").trim().slice(0, 80);
    const productName = compactTitle || `Order ${orderReference}`;
    const description = (compactTitle
      ? `PinkQuill ${orderReference} — ${compactTitle}`
      : `PinkQuill order ${orderReference}`) + convertedNote;

    // Reuse the order's current session if it is still open AND still charges
    // the right total; otherwise expire it so only one live session exists.
    const { data: existingOrder } = await supabaseAdmin
      .from("orders")
      .select("checkout_session_id")
      .eq("id", order.id)
      .single();

    if (existingOrder?.checkout_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(
          existingOrder.checkout_session_id
        );

        if (existingSession.status === "complete") {
          return {
            mode: "stripe",
            clientSecret: null,
            sessionId: existingSession.id,
            message: "Payment already completed",
          };
        }

        if (existingSession.status === "open" && existingSession.client_secret) {
          if (
            existingSession.amount_total === totalCents &&
            (existingSession.currency || "").toLowerCase() === currency
          ) {
            return {
              mode: "stripe",
              clientSecret: existingSession.client_secret,
              sessionId: existingSession.id,
            };
          }
          // Total changed (promo applied/removed): retire the stale session.
          await stripe.checkout.sessions.expire(existingSession.id);
        }
      } catch {
        // Session not found or already expired — create a new one
      }
    }

    const metadata = {
      order_id: order.id,
      order_number: order.orderNumber || "",
      buyer_id: order.buyerId,
      listing_type: order.listingType,
    };

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency,
          product_data: { name: productName, description },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ];
    if (buyerFeeCents > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: "Processing fee",
            description: "Payment processing and buyer protection",
          },
          unit_amount: buyerFeeCents,
        },
        quantity: 1,
      });
    }

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      ui_mode: "embedded",
      // Cards only: delayed-notification methods would complete the session
      // before money exists (checkout.session.completed with payment_status
      // 'unpaid'). Revisit in 1c if other methods are wanted.
      payment_method_types: ["card"],
      line_items: lineItems,
      payment_intent_data: {
        capture_method: "automatic",
        metadata,
        ...(normalizeDescriptorSuffix(order.orderNumber)
          ? { statement_descriptor_suffix: normalizeDescriptorSuffix(order.orderNumber) }
          : {}),
      },
      ...(order.buyerEmail ? { customer_email: order.buyerEmail } : {}),
      metadata,
      return_url: `${getSiteUrl()}/checkout/${order.id}/complete?session_id={CHECKOUT_SESSION_ID}`,
    };

    // Idempotency: concurrent calls for the same order + total get the same
    // session back from Stripe instead of minting two. If the replayed session
    // is no longer open (keys live 24h), create a fresh one under a new key.
    const stableKey = `checkout_${order.id}_${totalCents}_${currency}`;
    let session = await stripe.checkout.sessions.create(params, { idempotencyKey: stableKey });
    if (session.status !== "open" || !session.client_secret) {
      session = await stripe.checkout.sessions.create(params, {
        idempotencyKey: `${stableKey}_${Date.now()}`,
      });
    }

    await supabaseAdmin
      .from("orders")
      .update({
        payment_provider: "stripe",
        payment_reference: session.id,
        checkout_session_id: session.id,
        payment_status: "pending",
      })
      .eq("id", order.id);

    return {
      mode: "stripe",
      clientSecret: session.client_secret,
      sessionId: session.id,
    };
  }

  // ============================================================================
  // TRANSFERS — one Stripe Transfer per released payout (payout worker only)
  // ============================================================================

  async createTransfer(request: TransferRequest): Promise<TransferResult> {
    const stripe = getStripeServer();
    try {
      const transfer = await stripe.transfers.create(
        {
          amount: request.amountCents,
          currency: request.currency,
          destination: request.destinationAccountId,
          transfer_group: request.orderId,
          // Tie the transfer to the charge that funded it so it can draw on
          // the platform's pending balance instead of waiting for settlement.
          ...(request.sourceChargeId ? { source_transaction: request.sourceChargeId } : {}),
          metadata: { payout_id: request.payoutId, order_id: request.orderId, ...(request.metadata || {}) },
        },
        { idempotencyKey: `payout_${request.payoutId}` }
      );
      return {
        transferId: transfer.id,
        balanceTransactionId:
          typeof transfer.balance_transaction === "string"
            ? transfer.balance_transaction
            : transfer.balance_transaction?.id ?? null,
        amountCents: transfer.amount,
      };
    } catch (err) {
      const stripeErr = err as { code?: string; message?: string; type?: string };
      // Destination problems are not transient: block until the seller fixes their account.
      if (
        stripeErr.code === "account_invalid" ||
        stripeErr.code === "transfers_not_allowed" ||
        /No such destination|capabilit|not enabled|restricted/i.test(stripeErr.message || "")
      ) {
        throw new TransferBlockedError(stripeErr.code || "destination_invalid", stripeErr.message);
      }
      throw err;
    }
  }

  // ============================================================================
  // REFUNDS / REVERSALS — called by lib/refunds-server.ts only
  // ============================================================================

  async createRefund(request: RefundRequest): Promise<RefundResult> {
    const stripe = getStripeServer();
    const refund = await stripe.refunds.create(
      {
        payment_intent: request.paymentIntentId,
        amount: request.amountCents,
        ...(request.reason ? { reason: request.reason } : {}),
        metadata: request.metadata ?? {},
      },
      { idempotencyKey: request.idempotencyKey }
    );
    return { refundId: refund.id, amountCents: refund.amount, status: refund.status ?? null };
  }

  async reverseTransfer(request: ReversalRequest): Promise<ReversalResult> {
    const stripe = getStripeServer();
    try {
      const reversal = await stripe.transfers.createReversal(
        request.transferId,
        { amount: request.amountCents, metadata: request.metadata ?? {} },
        { idempotencyKey: request.idempotencyKey }
      );
      return { reversalId: reversal.id, amountCents: reversal.amount };
    } catch (err) {
      const e = err as { code?: string; message?: string };
      // Insufficient connected-account balance etc.: not retryable without a human.
      throw new TransferBlockedError(e.code || "reversal_failed", e.message);
    }
  }
}
