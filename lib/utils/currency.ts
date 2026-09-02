/**
 * Single money formatter (there were five copies with drifting options).
 */
export function formatCurrency(
  amount: number | string,
  currency: string = "USD",
  options: { fractionDigits?: number } = {}
): string {
  const value = Number(amount);
  const digits = options.fractionDigits ?? 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "USD").toUpperCase(),
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}
