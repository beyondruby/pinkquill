import { supabaseAdmin } from "@/lib/supabase-server";

interface PaymentMutationOptions {
  orderId: string;
  provider: "stripe" | "placeholder";
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
}: Omit<PaymentMutationOptions, "actorId"> & { reason?: string | null }): Promise<PaymentMutationResult> {
  const { data, error } = await supabaseAdmin.rpc("mark_order_payment_failed", {
    p_order_id: orderId,
    p_provider: provider,
    p_payment_reference: paymentReference,
    p_reason: reason ?? null,
    p_source: source,
  });

  if (error || !data) {
    throw new Error(error?.message || "Failed to mark order payment as failed");
  }

  return data as PaymentMutationResult;
}
