import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { normalizePaymentProvider, type PaymentProvider } from "@/lib/payments";
import { finalizeOrderEscrowRelease } from "@/lib/payments-server";
import { getStripeServer } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

type EscrowOrder = {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
  listing_type: string;
  payment_provider: PaymentProvider | null;
  payment_status: string;
  payment_reference: string | null;
  escrow_released: boolean | null;
};

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
      scope: "payments.escrow_release",
      limit: 20,
      windowSeconds: 60,
      userId: user.id,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 60);
    }

    const parsed = await safeJsonParse<{ order_id?: string }>(request);
    if ("error" in parsed) return parsed.error;
    const { order_id: orderId } = parsed.data;

    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, seller_id, status, listing_type, payment_provider, payment_status, payment_reference, escrow_released")
      .eq("id", orderId)
      .single<EscrowOrder>();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (user.id !== order.buyer_id && user.id !== order.seller_id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (order.listing_type !== "service") {
      return NextResponse.json({ error: "Escrow release only applies to commission orders" }, { status: 400 });
    }

    if (order.status !== "completed") {
      return NextResponse.json(
        { error: "Order must be completed before releasing escrow" },
        { status: 400 }
      );
    }

    if (order.escrow_released) {
      return NextResponse.json({ success: true, already_released: true });
    }

    if (!["authorized", "paid"].includes(order.payment_status)) {
      return NextResponse.json(
        { error: `Cannot release escrow with payment status ${order.payment_status}` },
        { status: 400 }
      );
    }

    let paymentReference = order.payment_reference || null;
    const providerName = normalizePaymentProvider(order.payment_provider);

    if (providerName === "stripe") {
      if (!paymentReference) {
        return NextResponse.json(
          { error: "Missing Stripe payment reference for escrow release" },
          { status: 400 }
        );
      }

      const stripe = getStripeServer();
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentReference);

      if (paymentIntent.status === "requires_capture") {
        const captured = await stripe.paymentIntents.capture(
          paymentReference,
          {},
          { idempotencyKey: `escrow_release_${order.id}` }
        );
        paymentReference = captured.id;
      } else if (paymentIntent.status !== "succeeded") {
        return NextResponse.json(
          { error: `Cannot release escrow: payment status is ${paymentIntent.status}` },
          { status: 409 }
        );
      }
    }

    const result = await finalizeOrderEscrowRelease({
      orderId: order.id,
      provider: providerName,
      paymentReference: paymentReference || `placeholder:${order.id}`,
      actorId: user.id,
      source: "api.stripe.escrow_release",
    });

    return NextResponse.json({
      success: true,
      provider: providerName,
      already_released: result.already_processed,
    });
  } catch (error) {
    console.error("[Escrow Release]", error);
    const message = error instanceof Error ? error.message : "Failed to release escrow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
