import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getProviderByName } from "@/lib/payment-provider";
import { getPaymentProvider, type PaymentProvider } from "@/lib/payments";

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
      limit: 30,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const ipRateLimit = await checkRateLimit({
      request,
      scope: "payments.checkout.ip",
      limit: 90,
      windowSeconds: 300,
    });
    if (!ipRateLimit.allowed) {
      return rateLimitResponse(ipRateLimit, 300);
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
      limit: 12,
      windowSeconds: 300,
      identifier: `user:${user.id}:order:${orderId}`,
    });
    if (!orderRateLimit.allowed) {
      return rateLimitResponse(orderRateLimit, 300);
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

    const providerName = resolveProviderForCheckout(order, orderAmount);
    const provider = getProviderByName(providerName);
    const result = await provider.createCheckoutSession({
      id: order.id,
      buyerId: user.id,
      buyerEmail: user.email ?? undefined,
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
