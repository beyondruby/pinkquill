export type PaymentProvider = "placeholder" | "stripe";

export const normalizePaymentProvider = (
  value?: string | null
): PaymentProvider => {
  const lower = value?.toLowerCase();
  if (lower === "stripe") return "stripe";
  return "placeholder";
};

export function getPaymentProvider(): PaymentProvider {
  const configured = process.env.PAYMENTS_PROVIDER ?? process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER;
  return normalizePaymentProvider(configured);
}

export function isPlaceholderPayments(): boolean {
  return getPaymentProvider() === "placeholder";
}

/** 5% flat platform fee on all sales */
export const PLATFORM_FEE_RATE = 0.05;
