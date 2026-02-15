import Stripe from "stripe";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function resolveLatestCharge(paymentIntent: Stripe.PaymentIntent): Stripe.Charge | null {
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge || typeof latestCharge === "string") return null;
  return latestCharge as Stripe.Charge;
}

export function extractStripeDeclineDetails(paymentIntent: Stripe.PaymentIntent): Record<string, unknown> {
  const lastError = paymentIntent.last_payment_error || null;
  const charge = resolveLatestCharge(paymentIntent);
  const chargeOutcome = asRecord(charge?.outcome);
  const paymentMethodDetails = asRecord(charge?.payment_method_details);
  const cardDetails = asRecord(paymentMethodDetails?.card);
  const cardChecks = asRecord(cardDetails?.checks);

  return {
    payment_intent_id: paymentIntent.id,
    payment_intent_status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    error_type: lastError?.type || null,
    error_code: lastError?.code || null,
    decline_code: lastError?.decline_code || null,
    message: lastError?.message || null,
    doc_url: lastError?.doc_url || null,
    charge_id: charge?.id || null,
    charge_status: charge?.status || null,
    charge_failure_code: charge?.failure_code || null,
    charge_failure_message: charge?.failure_message || null,
    network_status: asString(chargeOutcome?.network_status),
    risk_level: asString(chargeOutcome?.risk_level),
    risk_score: asNumber(chargeOutcome?.risk_score),
    seller_message: asString(chargeOutcome?.seller_message),
    outcome_type: asString(chargeOutcome?.type),
    outcome_reason: asString(chargeOutcome?.reason),
    cvc_check: asString(cardChecks?.cvc_check),
    postal_code_check: asString(cardChecks?.address_postal_code_check),
    avs_line1_check: asString(cardChecks?.address_line1_check),
    card_brand: asString(cardDetails?.brand),
    card_country: asString(cardDetails?.country),
    card_funding: asString(cardDetails?.funding),
    three_d_secure_result: asString(asRecord(cardDetails?.three_d_secure)?.result),
  };
}
