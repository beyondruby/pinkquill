"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { buildAuthenticatedHeaders } from "@/lib/auth-client";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils/currency";
import { shortDate } from "@/components/orders/orderFormat";
import { Spinner } from "@/components/ui/Loading";
import Button from "@/components/ui/Button";

type CheckoutStatus = "loading" | "success" | "failed" | "expired" | "processing";

const MAX_POLLS = 15;
const POLL_INTERVAL_MS = 2000;
const AUTO_REDIRECT_DELAY_MS = 5000;

interface PaidOrderRow {
  order_number: string;
  listing_type: "product" | "service";
  total_amount: number | null;
  amount: number;
  currency: string;
  due_date: string | null;
  shipping_address: { city?: string; country?: string } | null;
  product: {
    title: string;
    delivery_type: string | null;
    media: { media_url: string; is_primary: boolean }[] | null;
    seller: { username: string; display_name: string | null } | null;
  } | null;
  pricing: { variant_name: string | null; delivery_days: number | null } | null;
}

/**
 * /checkout/[orderId]/complete — the page Stripe returns to. The database
 * (written by the webhook) is the only source of truth: Stripe's own session
 * status is never used to declare success. On "paid" it reads the order row
 * and shows what was bought before continuing to the order page.
 */
export default function CheckoutCompletePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<CheckoutStatus>("loading");
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<PaidOrderRow | null>(null);
  const [countdown, setCountdown] = useState(AUTO_REDIRECT_DELAY_MS / 1000);
  const pollCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkStatus = useCallback(async (): Promise<boolean> => {
    const query = sessionId
      ? `session_id=${encodeURIComponent(sessionId)}`
      : `order_id=${encodeURIComponent(orderId)}`;

    try {
      const res = await fetch(`/api/checkout/status?${query}`, {
        headers: await buildAuthenticatedHeaders(),
      });

      if (!res.ok) {
        // Auth might not be ready yet, or the webhook hasn't linked the
        // session to the order yet — keep polling.
        return false;
      }

      const data = await res.json();

      if (data.order_payment_status === "paid") {
        setStatus("success");
        return true;
      }
      if (data.order_status === "expired") {
        setStatus("expired");
        return true;
      }
      if (data.order_payment_status === "failed") {
        setFailureMessage(data.last_payment_error || null);
        setStatus("failed");
        return true;
      }
      return false; // still pending — keep polling
    } catch {
      return false;
    }
  }, [sessionId, orderId]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;

      const done = await checkStatus();

      if (!done && !cancelled) {
        pollCountRef.current += 1;
        if (pollCountRef.current >= MAX_POLLS) {
          // Webhook hasn't landed yet. Never claim failure: the charge may
          // have succeeded. The order page keeps updating on its own.
          setStatus("processing");
          return;
        }
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [checkStatus]);

  // On success, read the order row for the receipt card (a read; nothing is written here).
  useEffect(() => {
    if (status !== "success") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select(`
          order_number, listing_type, total_amount, amount, currency, due_date, shipping_address,
          product:products (title, delivery_type, media:product_media (media_url, is_primary), seller:profiles!products_seller_id_fkey (username, display_name)),
          pricing:product_pricing!orders_pricing_id_fkey (variant_name, delivery_days)
        `)
        .eq("id", orderId)
        .maybeSingle();
      if (!cancelled && data) setOrder(data as unknown as PaidOrderRow);
    })();
    return () => { cancelled = true; };
  }, [status, orderId]);

  // Auto-continue to the order page on success
  useEffect(() => {
    if (status !== "success") return;
    const tick = setInterval(() => setCountdown((prev) => Math.max(prev - 1, 0)), 1000);
    const go = setTimeout(() => router.push(`/orders/${orderId}`), AUTO_REDIRECT_DELAY_MS);
    return () => { clearInterval(tick); clearTimeout(go); };
  }, [status, orderId, router]);

  const sellerName = order?.product?.seller?.display_name || order?.product?.seller?.username || "the creator";
  const firstName = sellerName.split(" ")[0];
  const image = order?.product?.media?.find((m) => m.is_primary)?.media_url || order?.product?.media?.[0]?.media_url;
  const isCommission = order?.listing_type === "service";
  const isPhysical = order?.listing_type === "product" && order.product?.delivery_type !== "digital";

  const badge = (tone: "neutral" | "success" | "danger" | "warning", child: React.ReactNode) => {
    const cls = { neutral: "bg-subtle border-border-light text-muted", success: "bg-emerald-50 border-emerald-200 text-emerald-700", danger: "bg-red-50 border-red-200 text-red-700", warning: "bg-amber-50 border-amber-200 text-amber-700" }[tone];
    return <span className={`w-14 h-14 rounded-full border inline-flex items-center justify-center ${cls}`} aria-hidden="true">{child}</span>;
  };
  const check = <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
  const cross = <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M6 18L18 6M6 6l12 12" /></svg>;
  const clock = <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <Spinner size="xl" className="text-purple-primary mx-auto" />
            <h1 className="font-display text-xl font-semibold text-ink mt-4">Confirming your payment</h1>
            <p className="text-sm font-body text-muted mt-2">Waiting for the bank&apos;s answer. This usually takes a few seconds.</p>
          </>
        )}

        {status === "success" && (
          <>
            {badge("success", check)}
            <h1 className="font-display text-xl font-semibold text-ink mt-4">
              {order ? (isCommission ? `Paid · ${firstName} is on it` : "Paid") : "Payment confirmed"}
            </h1>
            <p className="text-sm font-body text-muted mt-2 max-w-[40ch] mx-auto">
              {!order
                ? "Your order is confirmed."
                : isCommission
                  ? `${order.pricing?.delivery_days ? `The ${order.pricing.delivery_days}-day clock started. ` : ""}You'll hear from ${firstName} on your order page; the delivery lands there too.`
                  : isPhysical
                    ? "The seller has your address. Tracking appears on your order page once it ships."
                    : "Your files are ready on your order page."}
            </p>
            {order && (
              <div className="mt-5 text-left rounded-2xl border border-border-light bg-subtle p-4 flex gap-3">
                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 shrink-0">
                  {image && <Image src={image} alt="" fill className="object-cover" sizes="56px" />}
                </div>
                <div className="min-w-0 flex-1 text-sm font-body">
                  <p className="font-ui font-semibold text-ink truncate">{order.product?.title || "Order"}</p>
                  <p className="text-xs text-muted">
                    {isCommission
                      ? [order.pricing?.variant_name ? `${order.pricing.variant_name} package` : "Commission", order.due_date ? `due ${shortDate(order.due_date)}` : null].filter(Boolean).join(" · ")
                      : isPhysical
                        ? `Ships to ${[order.shipping_address?.city, order.shipping_address?.country].filter(Boolean).join(", ") || "you"}`
                        : "Digital product"}
                  </p>
                  <div className="flex justify-between mt-2"><span className="text-muted">Total paid</span><span className="text-ink tabular-nums font-ui font-semibold">{formatCurrency(Number(order.total_amount ?? order.amount), order.currency)}</span></div>
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-center">
              <Button onClick={() => router.push(`/orders/${orderId}`)}>View your order</Button>
            </div>
            <p className="text-2xs font-body text-muted mt-2">Continuing in {countdown}s…</p>
          </>
        )}

        {status === "failed" && (
          <>
            {badge("danger", cross)}
            <h1 className="font-display text-xl font-semibold text-ink mt-4">Card declined</h1>
            <p className="text-sm font-body text-muted mt-2 max-w-[40ch] mx-auto">
              {failureMessage ? `Your bank said "${failureMessage}". ` : "Your card was declined. "}Nothing was charged. Try another card, or pay later from your order page.
            </p>
            <div className="mt-5 flex gap-2 justify-center">
              <Button variant="secondary" onClick={() => router.push(`/orders/${orderId}`)}>Pay later</Button>
              <Button onClick={() => router.push(`/checkout/${orderId}`)}>Try again</Button>
            </div>
          </>
        )}

        {status === "processing" && (
          <>
            {badge("neutral", clock)}
            <h1 className="font-display text-xl font-semibold text-ink mt-4">Still processing</h1>
            <p className="text-sm font-body text-muted mt-2 max-w-[40ch] mx-auto">The bank is taking longer than usual. Your order page updates on its own, and you&apos;ll get a notification either way.</p>
            <div className="mt-5 flex justify-center">
              <Button onClick={() => router.push(`/orders/${orderId}`)}>Go to your order</Button>
            </div>
          </>
        )}

        {status === "expired" && (
          <>
            {badge("warning", clock)}
            <h1 className="font-display text-xl font-semibold text-ink mt-4">Checkout expired</h1>
            <p className="text-sm font-body text-muted mt-2 max-w-[40ch] mx-auto">The payment form timed out. Nothing was charged; your request is still saved.</p>
            <div className="mt-5 flex justify-center">
              <Button onClick={() => router.push(`/checkout/${orderId}`)}>Start a new checkout</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
