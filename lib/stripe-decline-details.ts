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

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const result = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return result.length > 0 ? result : null;
}

function resolveStripeAccountId(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" && id.trim().length > 0 ? id : null;
  }
  return null;
}

function resolveLatestCharge(paymentIntent: Stripe.PaymentIntent): Stripe.Charge | null {
  const latestCharge = paymentIntent.latest_charge;
  if (!latestCharge || typeof latestCharge === "string") return null;
  return latestCharge as Stripe.Charge;
}

function classifyFailureCategory({
  outcomeType,
  declineCode,
  cvcCheck,
  postalCodeCheck,
  avsLine1Check,
  captureMethod,
  paymentIntentStatus,
}: {
  outcomeType: string | null;
  declineCode: string | null;
  cvcCheck: string | null;
  postalCodeCheck: string | null;
  avsLine1Check: string | null;
  captureMethod: string | null;
  paymentIntentStatus: string | null;
}): string {
  const avsFailed = postalCodeCheck === "fail" || avsLine1Check === "fail";

  if (outcomeType === "blocked") return "blocked_before_authorization";
  if (paymentIntentStatus === "requires_action" || declineCode === "authentication_required") {
    return "authentication_required";
  }
  if (avsFailed || declineCode === "incorrect_address" || declineCode === "incorrect_zip") {
    return "billing_address_mismatch";
  }
  if (cvcCheck === "fail" || declineCode === "incorrect_cvc") {
    return "card_verification_failed";
  }
  if (captureMethod === "manual" && ["card_not_supported", "transaction_not_allowed"].includes(declineCode || "")) {
    return "manual_capture_not_supported";
  }
  if (outcomeType === "issuer_declined" || declineCode) {
    return "issuer_declined";
  }
  return "unknown";
}

function buildIntegrationHints({
  transferDestination,
  onBehalfOf,
  captureMethod,
  automaticPaymentMethodsEnabled,
  cvcCheck,
  postalCodeCheck,
  avsLine1Check,
  declineCode,
  outcomeType,
}: {
  transferDestination: string | null;
  onBehalfOf: string | null;
  captureMethod: string | null;
  automaticPaymentMethodsEnabled: boolean;
  cvcCheck: string | null;
  postalCodeCheck: string | null;
  avsLine1Check: string | null;
  declineCode: string | null;
  outcomeType: string | null;
}): string[] {
  const hints = new Set<string>();

  if (transferDestination && !onBehalfOf) {
    hints.add("missing_on_behalf_of");
  }
  if (captureMethod === "manual") {
    hints.add("manual_capture");
  }
  if (captureMethod === "manual" && automaticPaymentMethodsEnabled) {
    hints.add("manual_capture_with_dynamic_payment_methods");
  }
  if (postalCodeCheck === "fail" || avsLine1Check === "fail") {
    hints.add("billing_address_mismatch");
  }
  if (cvcCheck === "fail") {
    hints.add("cvc_mismatch");
  }
  if (declineCode === "card_not_supported") {
    hints.add("issuer_card_restriction");
  }
  if (outcomeType === "blocked") {
    hints.add("stripe_or_network_block");
  }

  return Array.from(hints);
}

export function extractStripeDeclineDetails(paymentIntent: Stripe.PaymentIntent): Record<string, unknown> {
  const lastError = paymentIntent.last_payment_error || null;
  const charge = resolveLatestCharge(paymentIntent);
  const chargeOutcome = asRecord(charge?.outcome);
  const paymentMethodDetails = asRecord(charge?.payment_method_details);
  const cardDetails = asRecord(paymentMethodDetails?.card);
  const cardChecks = asRecord(cardDetails?.checks);
  const paymentMethod = lastError?.payment_method;
  const paymentMethodType = typeof paymentMethod === "string" ? null : paymentMethod?.type || null;
  const captureMethod = asString(paymentIntent.capture_method);
  const paymentMethodTypes = asStringArray(paymentIntent.payment_method_types) || [];
  const automaticPaymentMethodsEnabled = Boolean(paymentIntent.automatic_payment_methods?.enabled);
  const transferDestination = resolveStripeAccountId(paymentIntent.transfer_data?.destination);
  const onBehalfOf = resolveStripeAccountId(paymentIntent.on_behalf_of);
  const outcomeType = asString(chargeOutcome?.type);
  const declineCode = lastError?.decline_code || null;
  const cvcCheck = asString(cardChecks?.cvc_check);
  const postalCodeCheck = asString(cardChecks?.address_postal_code_check);
  const avsLine1Check = asString(cardChecks?.address_line1_check);
  const merchantContext = transferDestination
    ? (onBehalfOf ? "connected_account_settlement" : "platform_settlement")
    : "platform_direct";
  const failureCategory = classifyFailureCategory({
    outcomeType,
    declineCode,
    cvcCheck,
    postalCodeCheck,
    avsLine1Check,
    captureMethod,
    paymentIntentStatus: paymentIntent.status,
  });
  const integrationHints = buildIntegrationHints({
    transferDestination,
    onBehalfOf,
    captureMethod,
    automaticPaymentMethodsEnabled,
    cvcCheck,
    postalCodeCheck,
    avsLine1Check,
    declineCode,
    outcomeType,
  });

  return {
    payment_intent_id: paymentIntent.id,
    payment_intent_status: paymentIntent.status,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    capture_method: captureMethod,
    payment_method_type: paymentMethodType,
    payment_method_types: paymentMethodTypes,
    automatic_payment_methods_enabled: automaticPaymentMethodsEnabled,
    transfer_destination: transferDestination,
    on_behalf_of: onBehalfOf,
    merchant_context: merchantContext,
    error_type: lastError?.type || null,
    error_code: lastError?.code || null,
    decline_code: declineCode,
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
    outcome_type: outcomeType,
    outcome_reason: asString(chargeOutcome?.reason),
    cvc_check: cvcCheck,
    postal_code_check: postalCodeCheck,
    avs_line1_check: avsLine1Check,
    card_brand: asString(cardDetails?.brand),
    card_country: asString(cardDetails?.country),
    card_funding: asString(cardDetails?.funding),
    three_d_secure_result: asString(asRecord(cardDetails?.three_d_secure)?.result),
    failure_category: failureCategory,
    integration_hints: integrationHints,
  };
}
