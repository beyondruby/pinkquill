/**
 * Compact counts for stats and action rows: 999 → "999", 1200 → "1.2K",
 * 2_000_000 → "2M". One implementation for the profile stats, take tiles and
 * cards (finding P-29 listed five copies with two different outputs).
 * `null` / `undefined` (a private account's hidden count) renders as "-".
 */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}
