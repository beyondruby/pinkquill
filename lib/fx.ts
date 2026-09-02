/**
 * Settlement-currency quotes (docs/commissions/03-progress.md, Phase 1c).
 *
 * Listings are priced in USD. The platform's Stripe account settles in CAD
 * today, so buyers are charged in CAD at a cached mid-market rate plus a small
 * buffer; Pinkquill itself never pays a currency conversion. When a USD bank
 * account is added, set platform_settings.settlement_currency = "usd" and this
 * module degrades to rate 1 / no conversion.
 *
 * Rate source: frankfurter.dev (ECB reference rates, no key). Cached in
 * fx_rates; refreshed when older than fx_max_age_hours; a stale cache (≤ 3
 * days) is used if the feed is down; otherwise checkout is refused rather than
 * guessing.
 */
import { supabaseAdmin } from "@/lib/supabase-server";

export interface SettlementQuote {
  listingCurrency: string;
  chargeCurrency: string;
  /** listing → charge rate actually applied (buffer excluded) */
  rate: number;
  rateAt: string;
  buffer: number;
  /** what Stripe will charge, in charge currency */
  chargeAmountCents: number;
  chargeFeeCents: number;
  sellerCents: number;
  platformCents: number;
  buyerFeeCents: number;
  converted: boolean;
}

async function setting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await supabaseAdmin.from("platform_settings").select("value").eq("key", key).maybeSingle();
  if (!data) return fallback;
  return data.value as T;
}

async function fetchRate(base: string, quote: string): Promise<number> {
  const url = `https://api.frankfurter.dev/v1/latest?base=${base.toUpperCase()}&symbols=${quote.toUpperCase()}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`fx feed ${res.status}`);
  const json = (await res.json()) as { rates?: Record<string, number> };
  const rate = json.rates?.[quote.toUpperCase()];
  if (!rate || !Number.isFinite(rate) || rate <= 0) throw new Error("fx feed returned no rate");
  return rate;
}

export async function getRate(base: string, quote: string): Promise<{ rate: number; at: string }> {
  const b = base.toLowerCase();
  const q = quote.toLowerCase();
  if (b === q) return { rate: 1, at: new Date().toISOString() };

  const maxAgeHours = Number(await setting<number | string>("fx_max_age_hours", 6)) || 6;
  const { data: cached } = await supabaseAdmin
    .from("fx_rates")
    .select("rate, fetched_at")
    .eq("base", b)
    .eq("quote", q)
    .maybeSingle();

  const ageMs = cached ? Date.now() - new Date(cached.fetched_at as string).getTime() : Infinity;
  if (cached && ageMs < maxAgeHours * 3600_000) {
    return { rate: Number(cached.rate), at: cached.fetched_at as string };
  }

  try {
    const rate = await fetchRate(b, q);
    const at = new Date().toISOString();
    await supabaseAdmin
      .from("fx_rates")
      .upsert({ base: b, quote: q, rate, source: "frankfurter", fetched_at: at }, { onConflict: "base,quote" });
    return { rate, at };
  } catch (err) {
    if (cached && ageMs < 3 * 24 * 3600_000) {
      console.warn("[fx] feed unavailable, using cached rate", err);
      return { rate: Number(cached.rate), at: cached.fetched_at as string };
    }
    throw new Error("Exchange rate unavailable; please try again in a few minutes.");
  }
}

/** Convert an order's USD money columns into the settlement currency for charging. */
export async function quoteSettlement(order: {
  currency: string;
  amount: number;
  buyer_fee: number;
  platform_fee: number;
  seller_amount: number;
}): Promise<SettlementQuote> {
  const settlementCurrency = String(await setting<string>("settlement_currency", "cad")).toLowerCase();
  const listingCurrency = (order.currency || "usd").toLowerCase();
  const buffer = Number(await setting<number | string>("fx_buffer_rate", 0.015)) || 0;

  const amountCents = Math.round(Number(order.amount) * 100);
  const buyerFeeCents = Math.round(Number(order.buyer_fee || 0) * 100);
  const platformCents = Math.round(Number(order.platform_fee || 0) * 100);
  const sellerCents = Math.round(Number(order.seller_amount || 0) * 100);

  if (settlementCurrency === listingCurrency) {
    return {
      listingCurrency,
      chargeCurrency: listingCurrency,
      rate: 1,
      rateAt: new Date().toISOString(),
      buffer: 0,
      chargeAmountCents: amountCents + buyerFeeCents,
      chargeFeeCents: buyerFeeCents,
      sellerCents,
      platformCents,
      buyerFeeCents,
      converted: false,
    };
  }

  const { rate, at } = await getRate(listingCurrency, settlementCurrency);
  const conv = (cents: number) => Math.round(cents * rate);
  // Buffer only on what the buyer pays; the seller/platform split is fixed at
  // the mid-market rate so the buffer lands in fx_reserve.
  const chargeAmountCents = Math.ceil((amountCents + buyerFeeCents) * rate * (1 + buffer));
  const chargeFeeCents = Math.ceil(buyerFeeCents * rate * (1 + buffer));

  return {
    listingCurrency,
    chargeCurrency: settlementCurrency,
    rate,
    rateAt: at,
    buffer,
    chargeAmountCents,
    chargeFeeCents,
    sellerCents: conv(sellerCents),
    platformCents: conv(platformCents),
    buyerFeeCents: conv(buyerFeeCents),
    converted: true,
  };
}
