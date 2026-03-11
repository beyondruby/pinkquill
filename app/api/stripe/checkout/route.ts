import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getProviderByName } from "@/lib/payment-provider";
import { getPaymentProvider, type PaymentProvider } from "@/lib/payments";
import {
  collectPaymentMethodDomains,
  ensurePaymentMethodDomainsRegistered,
} from "@/lib/stripe-payment-method-domains";
import { getStripeServer } from "@/lib/stripe";

export const runtime = "nodejs";

type OrderForCheckout = {
  id: string;
  order_number: string;
  buyer_id: string;
  buyer_phone: string | null;
  status: string;
  listing_type: string;
  shipping_address: Record<string, unknown> | null;
  amount: number;
  currency: string;
  payment_provider: string | null;
  payment_reference: string | null;
  payment_intent_id: string | null;
  product: {
    delivery_type: string;
    title: string;
  } | null;
};

const REQUIRED_SHIPPING_FIELDS = ["name", "line1", "city", "country"] as const;

function hasRequiredShippingAddress(address: Record<string, unknown> | null): boolean {
  if (!address) return false;
  return REQUIRED_SHIPPING_FIELDS.every((field) => {
    const value = address[field];
    return typeof value === "string" && value.trim().length > 0;
  });
}

function resolveProviderForCheckout(order: OrderForCheckout, orderAmount: number): PaymentProvider {
  // Payable orders must use Stripe. Placeholder is only for zero-total orders.
  if (orderAmount > 0) {
    return "stripe";
  }

  if (order.payment_intent_id && order.payment_intent_id.startsWith("pi_")) {
    return "stripe";
  }

  if (order.payment_reference && order.payment_reference.startsWith("placeholder:")) {
    return "placeholder";
  }

  return getPaymentProvider();
}

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
      request,
      scope: "payments.checkout",
      limit: 10,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const ipRateLimit = await checkRateLimit({
      request,
      scope: "payments.checkout.ip",
      limit: 30,
      windowSeconds: 600,
    });
    if (!ipRateLimit.allowed) {
      return rateLimitResponse(ipRateLimit, 600);
    }

    const parsed = await safeJsonParse<{ order_id?: string }>(request);
    if ("error" in parsed) return parsed.error;
    const { order_id: orderId } = parsed.data;

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const orderRateLimit = await checkRateLimit({
      request,
      scope: "payments.checkout.order",
      limit: 4,
      windowSeconds: 900,
      identifier: `user:${user.id}:order:${orderId}`,
    });
    if (!orderRateLimit.allowed) {
      return rateLimitResponse(orderRateLimit, 900);
    }

    const orderDailyRateLimit = await checkRateLimit({
      request,
      scope: "payments.checkout.order.daily",
      limit: 8,
      windowSeconds: 86400,
      identifier: `user:${user.id}:order:${orderId}`,
    });
    if (!orderDailyRateLimit.allowed) {
      return rateLimitResponse(orderDailyRateLimit, 86400);
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(`
        id,
        order_number,
        buyer_id,
        buyer_phone,
        status,
        listing_type,
        shipping_address,
        amount,
        currency,
        payment_provider,
        payment_reference,
        payment_intent_id,
        product:products (delivery_type, title)
      `)
      .eq("id", orderId)
      .single<OrderForCheckout>();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (order.status !== "pending_payment") {
      return NextResponse.json(
        { error: `Order is already ${order.status}` },
        { status: 400 }
      );
    }

    const orderAmount = Number(order.amount);
    if (!Number.isFinite(orderAmount) || orderAmount < 0) {
      return NextResponse.json({ error: "Invalid order amount" }, { status: 400 });
    }

    const requiresShippingDetails =
      order.listing_type === "product"
      && order.product?.delivery_type !== "digital"
      && (!hasRequiredShippingAddress(order.shipping_address) || !String(order.buyer_phone || "").trim());

    if (requiresShippingDetails) {
      return NextResponse.json(
        { error: "Complete shipping details before checkout." },
        { status: 400 }
      );
    }

    // Free orders should bypass external payment providers.
    if (orderAmount <= 0) {
      const providerName: PaymentProvider = "placeholder";
      const provider = getProviderByName(providerName);
      const result = await provider.createCheckoutSession({
        id: order.id,
        buyerId: user.id,
        buyerEmail: user.email ?? undefined,
        amount: 0,
        currency: String(order.currency || "usd"),
        listingType: order.listing_type,
        orderNumber: order.order_number,
        productTitle: order.product?.title,
        shippingAddress: order.shipping_address,
        buyerPhone: order.buyer_phone,
        existingPaymentRef: null,
      });

      return NextResponse.json({
        mode: result.mode,
        provider: providerName,
        client_secret: result.clientToken,
        payment_reference: result.paymentReference,
        message: result.message || "No payment required for this order.",
      });
    }

    // Fetch buyer display name for Stripe Customer creation and billing details
    const { data: buyerProfile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const providerName = resolveProviderForCheckout(order, orderAmount);
    if (providerName === "stripe") {
      const stripe = getStripeServer();
      const domains = collectPaymentMethodDomains(request);
      try {
        await ensurePaymentMethodDomainsRegistered(stripe, domains);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to register payment method domain";
        // Wallet setup should never block checkout preparation.
        console.warn("[Checkout Prepare] Payment method domain registration warning", { domains, message });
      }
    }
    const provider = getProviderByName(providerName);
    const result = await provider.createCheckoutSession({
      id: order.id,
      buyerId: user.id,
      buyerEmail: user.email ?? undefined,
      buyerName: buyerProfile?.display_name || undefined,
      amount: orderAmount,
      currency: String(order.currency || "usd"),
      listingType: order.listing_type,
      orderNumber: order.order_number,
      productTitle: order.product?.title,
      shippingAddress: order.shipping_address,
      buyerPhone: order.buyer_phone,
      existingPaymentRef: order.payment_reference || order.payment_intent_id,
    });

    return NextResponse.json({
      mode: result.mode,
      provider: providerName,
      client_secret: result.clientToken,
      payment_reference: result.paymentReference,
      message: result.message || null,
    });
  } catch (error) {
    console.error("[Checkout Prepare]", error);
    const message = error instanceof Error ? error.message : "Failed to prepare checkout";
    if (message.includes("Seller Stripe account is not ready")) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes("without the card_payments capability enabled")) {
      return NextResponse.json(
        {
          error: "The seller's Stripe account is missing the card payments capability. Ask the seller to reopen Stripe onboarding and complete card payments setup.",
        },
        { status: 409 }
      );
    }
    if (message.includes("No valid payment method types for this Payment Intent")) {
      return NextResponse.json(
        {
          error: "This seller's payout account cannot currently accept checkout in the order currency. Ask the seller to update their Stripe setup or listing currency, then try again.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
