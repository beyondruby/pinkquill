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
import { reportOpsAlert } from "@/lib/ops";

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
      await reportOpsAlert({ kind: "fx_feed_unavailable", severity: "warning", message: `Using cached ${b}/${q} rate from ${cached.fetched_at}`, context: { error: String(err) } });
      return { rate: Number(cached.rate), at: cached.fetched_at as string };
    }
    await reportOpsAlert({ kind: "fx_feed_unavailable", severity: "critical", message: `No usable ${b}/${q} rate; checkout refused`, context: { error: String(err) } });
    throw new Error("Exchange rate unavailable; please try again in a few minutes.");
  }
}

export interface QuoteInput {
  listingCurrency: string;
  settlementCurrency: string;
  rate: number;
  rateAt: string;
  buffer: number;
  amountCents: number;
  buyerFeeCents: number;
  platformCents: number;
  sellerCents: number;
}

/**
 * Pure quote math (unit-tested). Buffer applies only to what the buyer pays;
 * the seller/platform/buyer-fee split is fixed at the mid-market rate so the
 * buffer lands in fx_reserve. A $0 order never converts.
 */
export function buildSettlementQuote(input: QuoteInput): SettlementQuote {
  const listingCurrency = input.listingCurrency.toLowerCase();
  const settlementCurrency = input.settlementCurrency.toLowerCase();
  const { amountCents, buyerFeeCents, platformCents, sellerCents } = input;
  const totalListingCents = amountCents + buyerFeeCents;

  if (settlementCurrency === listingCurrency || totalListingCents <= 0) {
    return {
      listingCurrency,
      chargeCurrency: listingCurrency,
      rate: 1,
      rateAt: input.rateAt,
      buffer: 0,
      chargeAmountCents: totalListingCents,
      chargeFeeCents: buyerFeeCents,
      sellerCents,
      platformCents,
      buyerFeeCents,
      converted: false,
    };
  }
  if (!(input.rate > 0)) throw new Error("Invalid exchange rate");
  const conv = (cents: number) => Math.round(cents * input.rate);
  const chargeAmountCents = Math.ceil(totalListingCents * input.rate * (1 + input.buffer));
  const chargeFeeCents = Math.ceil(buyerFeeCents * input.rate * (1 + input.buffer));
  return {
    listingCurrency,
    chargeCurrency: settlementCurrency,
    rate: input.rate,
    rateAt: input.rateAt,
    buffer: input.buffer,
    chargeAmountCents,
    chargeFeeCents,
    sellerCents: conv(sellerCents),
    platformCents: conv(platformCents),
    buyerFeeCents: conv(buyerFeeCents),
    converted: true,
  };
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

  const needsRate = settlementCurrency !== listingCurrency && amountCents + buyerFeeCents > 0;
  const { rate, at } = needsRate ? await getRate(listingCurrency, settlementCurrency) : { rate: 1, at: new Date().toISOString() };
  return buildSettlementQuote({
    listingCurrency, settlementCurrency, rate, rateAt: at, buffer, amountCents, buyerFeeCents, platformCents, sellerCents,
  });
}
