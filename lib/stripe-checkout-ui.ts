import type {
  StripeElementsOptions,
  StripePaymentElementOptions,
} from "@stripe/stripe-js";

export interface StripeBillingDefaults {
  name?: string;
  email?: string;
  phone?: string;
}

function normalizeValue(value?: string | null): string | undefined {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

export function buildStripeBillingDefaults(
  values: StripeBillingDefaults
): StripeBillingDefaults | undefined {
  const billingDetails = {
    name: normalizeValue(values.name),
    email: normalizeValue(values.email),
    phone: normalizeValue(values.phone),
  };

  return Object.values(billingDetails).some(Boolean) ? billingDetails : undefined;
}

export function buildStripeElementsOptions(
  clientSecret: string,
  borderRadius = "8px"
): StripeElementsOptions {
  return {
    clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#8e44ad",
        borderRadius,
      },
    },
  };
}

export function buildStripePaymentElementOptions(
  billingDefaults?: StripeBillingDefaults
): StripePaymentElementOptions {
  return {
    ...(billingDefaults
      ? { defaultValues: { billingDetails: billingDefaults } }
      : {}),
    fields: {
      billingDetails: {
        name: "auto",
        email: "auto",
        phone: "auto",
        address: "auto",
      },
    },
  };
}
