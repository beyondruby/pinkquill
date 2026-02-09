import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { getPaymentProvider } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase-server";

type OrderForPayment = {
  id: string;
  buyer_id: string;
  status: string;
  listing_type: "product" | "service";
  shipping_address: Record<string, unknown> | null;
  amount: number;
  platform_fee: number;
  seller_amount: number;
  currency: string;
  payment_provider: string | null;
  payment_status: string;
};

async function createCompletedTransactions(order: OrderForPayment) {
  await supabaseAdmin.from("transactions").insert([
    {
      order_id: order.id,
      type: "payment",
      amount: order.amount,
      currency: order.currency,
      status: "completed",
      metadata: { provider: "placeholder" },
    },
    {
      order_id: order.id,
      type: "platform_fee",
      amount: order.platform_fee,
      currency: order.currency,
      status: "completed",
      metadata: { provider: "placeholder" },
    },
    {
      order_id: order.id,
      type: "seller_payout",
      amount: order.seller_amount,
      currency: order.currency,
      status: "completed",
      metadata: { provider: "placeholder" },
    },
  ]);
}

async function createAuthorizedTransactions(order: OrderForPayment) {
  await supabaseAdmin.from("transactions").insert([
    {
      order_id: order.id,
      type: "payment",
      amount: order.amount,
      currency: order.currency,
      status: "pending",
      metadata: { provider: "placeholder", escrow: "held" },
    },
    {
      order_id: order.id,
      type: "platform_fee",
      amount: order.platform_fee,
      currency: order.currency,
      status: "pending",
      metadata: { provider: "placeholder", escrow: "held" },
    },
    {
      order_id: order.id,
      type: "seller_payout",
      amount: order.seller_amount,
      currency: order.currency,
      status: "pending",
      metadata: { provider: "placeholder", escrow: "held" },
    },
  ]);
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { order_id: orderId } = body as { order_id?: string };
    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, buyer_id, status, listing_type, shipping_address, amount, platform_fee, seller_amount, currency, payment_provider, payment_status")
      .eq("id", orderId)
      .single<OrderForPayment>();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Idempotent success for already processed orders.
    if (order.status !== "pending_payment") {
      return NextResponse.json({
        success: true,
        already_processed: true,
        status: order.status,
      });
    }

    if (getPaymentProvider() === "stripe") {
      return NextResponse.json(
        {
          error: "Stripe setup is pending. Switch PAYMENTS_PROVIDER to placeholder to continue.",
        },
        { status: 503 }
      );
    }

    const isService = order.listing_type === "service";
    const isDigitalProduct = order.listing_type === "product" && !order.shipping_address;
    const now = new Date().toISOString();

    await supabaseAdmin
      .from("orders")
      .update({
        status: isDigitalProduct ? "delivered" : "paid",
        payment_status: isService ? "authorized" : "paid",
        payment_provider: "placeholder",
        delivered_at: isDigitalProduct ? now : null,
      })
      .eq("id", order.id);

    if (isService) {
      await createAuthorizedTransactions(order);
    } else {
      await createCompletedTransactions(order);
    }

    await supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      actor_id: user.id,
      event_type: "payment",
      metadata: {
        action: "payment_confirmed",
        provider: "placeholder",
        payment_status: isService ? "authorized" : "paid",
      },
    });

    await supabaseAdmin.from("order_messages").insert({
      order_id: order.id,
      sender_id: user.id,
      content: isDigitalProduct
        ? "Payment confirmed. Your digital order is now delivered."
        : "Payment confirmed. The order is now active.",
      message_type: "system",
    });

    return NextResponse.json({
      success: true,
      provider: "placeholder",
      status: isDigitalProduct ? "delivered" : "paid",
    });
  } catch (error) {
    console.error("[Payments Confirm]", error);
    const message = error instanceof Error ? error.message : "Failed to confirm payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
