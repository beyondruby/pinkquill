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

/** Platform Stripe account country (Canada). Sellers elsewhere are onboarded
 *  with Stripe's cross-border "recipient" service agreement. */
export const PLATFORM_COUNTRY = "CA";

/**
 * Countries a seller can pick at onboarding. Stripe is the authority: account
 * creation is attempted with this country and a clear error is shown if Stripe
 * cannot pay out there yet. Keep alphabetical by name.
 */
export const SELLER_COUNTRIES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "AR", name: "Argentina" }, { code: "AU", name: "Australia" }, { code: "AT", name: "Austria" },
  { code: "BH", name: "Bahrain" }, { code: "BE", name: "Belgium" }, { code: "BR", name: "Brazil" },
  { code: "BG", name: "Bulgaria" }, { code: "CA", name: "Canada" }, { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" }, { code: "HR", name: "Croatia" }, { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia" }, { code: "DK", name: "Denmark" }, { code: "EG", name: "Egypt" },
  { code: "EE", name: "Estonia" }, { code: "FI", name: "Finland" }, { code: "FR", name: "France" },
  { code: "DE", name: "Germany" }, { code: "GR", name: "Greece" }, { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" }, { code: "IN", name: "India" }, { code: "ID", name: "Indonesia" },
  { code: "IE", name: "Ireland" }, { code: "IL", name: "Israel" }, { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" }, { code: "KE", name: "Kenya" }, { code: "KR", name: "South Korea" },
  { code: "LV", name: "Latvia" }, { code: "LT", name: "Lithuania" }, { code: "LU", name: "Luxembourg" },
  { code: "MY", name: "Malaysia" }, { code: "MT", name: "Malta" }, { code: "MX", name: "Mexico" },
  { code: "MA", name: "Morocco" }, { code: "NL", name: "Netherlands" }, { code: "NZ", name: "New Zealand" },
  { code: "NG", name: "Nigeria" }, { code: "NO", name: "Norway" }, { code: "PK", name: "Pakistan" },
  { code: "PE", name: "Peru" }, { code: "PH", name: "Philippines" }, { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" }, { code: "RO", name: "Romania" }, { code: "SA", name: "Saudi Arabia" },
  { code: "SG", name: "Singapore" }, { code: "SK", name: "Slovakia" }, { code: "SI", name: "Slovenia" },
  { code: "ZA", name: "South Africa" }, { code: "ES", name: "Spain" }, { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" }, { code: "TW", name: "Taiwan" }, { code: "TH", name: "Thailand" },
  { code: "TR", name: "Türkiye" }, { code: "AE", name: "United Arab Emirates" }, { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" }, { code: "VN", name: "Vietnam" },
];

export function isSellerCountry(code: string | null | undefined): code is string {
  return !!code && SELLER_COUNTRIES.some((c) => c.code === code.toUpperCase());
}
