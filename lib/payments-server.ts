import type { PaymentProvider } from "@/lib/payments";
import { supabaseAdmin } from "@/lib/supabase-server";

interface PaymentMutationOptions {
  orderId: string;
  provider: PaymentProvider;
  paymentReference: string;
  actorId?: string | null;
  source: string;
}

export interface PaymentMutationResult {
  already_processed: boolean;
  order_id: string;
  status: string;
  payment_status: string;
}

export async function finalizeOrderPayment({
  orderId,
  provider,
  paymentReference,
  actorId,
  source,
}: PaymentMutationOptions): Promise<PaymentMutationResult> {
  const { data, error } = await supabaseAdmin.rpc("finalize_order_payment", {
    p_order_id: orderId,
    p_provider: provider,
    p_payment_reference: paymentReference,
    p_actor_id: actorId ?? null,
    p_source: source,
  });

  if (error || !data) {
    throw new Error(error?.message || "Failed to finalize order payment");
  }

  return data as PaymentMutationResult;
}

export async function markOrderPaymentFailed({
  orderId,
  provider,
  paymentReference,
  source,
  reason,
  errorDetails,
}: Omit<PaymentMutationOptions, "actorId"> & {
  reason?: string | null;
  errorDetails?: Record<string, unknown> | null;
}): Promise<PaymentMutationResult> {
  const { data, error } = await supabaseAdmin.rpc("mark_order_payment_failed", {
    p_order_id: orderId,
    p_provider: provider,
    p_payment_reference: paymentReference,
    p_reason: reason ?? null,
    p_source: source,
    p_error_details: errorDetails ?? {},
  });

  if (error || !data) {
    throw new Error(error?.message || "Failed to mark order payment as failed");
  }

  return data as PaymentMutationResult;
}

export async function markOrderExpired({
  orderId,
  provider,
  paymentReference,
  source,
}: Omit<PaymentMutationOptions, "actorId">): Promise<PaymentMutationResult> {
  const now = new Date().toISOString();

  const { data: order, error: fetchError } = await supabaseAdmin
    .from("orders")
    .select("id, status, payment_status")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    throw new Error(fetchError?.message || "Order not found");
  }

  // Only expire orders that are still pending payment
  if (order.status !== "pending_payment") {
    return {
      already_processed: true,
      order_id: order.id,
      status: order.status,
      payment_status: order.payment_status,
    };
  }

  const { error: updateError } = await supabaseAdmin
    .from("orders")
    .update({
      status: "expired",
      payment_status: "expired",
      updated_at: now,
    })
    .eq("id", orderId);

  if (updateError) throw new Error(updateError.message);

  await supabaseAdmin.from("order_events").insert({
    order_id: orderId,
    event_type: "payment",
    metadata: {
      action: "checkout_expired",
      provider,
      payment_reference: paymentReference,
      source,
    },
  });

  return {
    already_processed: false,
    order_id: orderId,
    status: "expired",
    payment_status: "expired",
  };
}
