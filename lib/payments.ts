export type PaymentProvider = "placeholder" | "stripe" | "paypal";

const normalizeProvider = (value?: string | null): PaymentProvider => {
  const lower = value?.toLowerCase();
  if (lower === "stripe") return "stripe";
  if (lower === "paypal") return "paypal";
  return "placeholder";
};

export function getPaymentProvider(): PaymentProvider {
  const configured = process.env.PAYMENTS_PROVIDER ?? process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER;
  return normalizeProvider(configured);
}

export function isPlaceholderPayments(): boolean {
  return getPaymentProvider() === "placeholder";
}

export const PLATFORM_FEE_RATES = {
  product: 0.08,
  service: 0.10,
} as const;
