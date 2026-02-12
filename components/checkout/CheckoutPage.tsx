"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { getStripe } from "@/lib/stripe-client";
import { getPayPalClientId } from "@/lib/paypal-client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCheckout } from "@/lib/hooks/usePayments";
import { useUpdateOrderDraft } from "@/lib/hooks/useOrders";
import { useValidatePromoCode, useApplyPromoCode, useRemovePromoCode } from "@/lib/hooks/usePromoCode";
import { supabase } from "@/lib/supabase";
import type { Order, ShippingAddress } from "@/lib/types/store";

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

async function buildAuthHeaders(initial?: HeadersInit): Promise<Headers> {
  const headers = new Headers(initial);
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return headers;
}

// ============================================================================
// ORDER LOADING
// ============================================================================

function useOrderData(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("orders")
          .select(`
            *,
            product:products (id, title, slug, listing_type, delivery_type,
              media:product_media (media_url, is_primary),
              seller:profiles!products_seller_id_fkey (id, username, display_name, avatar_url)
            ),
            pricing:product_pricing (id, pricing_type, variant_name, price, currency)
          `)
          .eq("id", orderId)
          .single();

        if (err) throw err;
        setOrder(data as unknown as Order);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load order");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  return { order, loading, error, setOrder };
}

// ============================================================================
// PROMO CODE SECTION
// ============================================================================

function PromoCodeSection({
  orderId,
  orderAmount,
  listingType,
  currency,
  onApplied,
  onCheckoutRefresh,
}: {
  orderId: string;
  orderAmount: number;
  listingType?: string;
  currency: string;
  onApplied: (discount: number, finalAmount: number) => void;
  onCheckoutRefresh?: () => Promise<unknown> | unknown;
}) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    discount: number;
    originalAmount: number;
    finalAmount: number;
  } | null>(null);
  const { loading: validating, error: validateError, validate, clear } = useValidatePromoCode();
  const { loading: applying, error: applyError, apply } = useApplyPromoCode();
  const { loading: removing, error: removeError, remove } = useRemovePromoCode();

  const asAmount = useCallback((value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }, []);

  const handleApply = useCallback(async () => {
    if (!code.trim()) return;

    const result = await validate(code, orderAmount, listingType);
    if (!result?.valid || !result.promo_code_id) return;

    const applyResult = await apply(orderId, result.promo_code_id);
    if (!applyResult?.success) return;

    const discount = asAmount(applyResult.discount_amount ?? result.discount_amount, 0);
    const finalAmount = asAmount(applyResult.final_amount ?? result.final_amount, orderAmount);
    const originalAmount = asAmount(applyResult.original_amount, orderAmount);

    setApplied({
      code: code.trim().toUpperCase(),
      discount,
      originalAmount,
      finalAmount,
    });

    onApplied(discount, finalAmount);
    await onCheckoutRefresh?.();
  }, [apply, asAmount, code, listingType, onApplied, onCheckoutRefresh, orderAmount, orderId, validate]);

  const isLoading = validating || applying || removing;
  const promoError = validateError || applyError || removeError;

  if (applied) {
    return (
      <div className="rounded-2xl border border-green-300 bg-green-50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-ui font-semibold text-green-800">Promo applied successfully</p>
            <p className="text-xs font-body text-green-700 mt-1">
              Code <span className="font-semibold">{applied.code}</span> saved you {formatCurrency(applied.discount, currency)}
            </p>
          </div>
          <button
            onClick={async () => {
              const result = await remove(orderId);
              if (!result?.success) return;
              const finalAmount = asAmount(result.final_amount, orderAmount);
              setApplied(null);
              setCode("");
              clear();
              onApplied(0, finalAmount);
              await onCheckoutRefresh?.();
            }}
            disabled={removing}
            className="rounded-full border border-green-300 px-3 py-1 text-xs font-ui font-semibold text-green-700 hover:bg-green-100 disabled:opacity-60"
          >
            {removing ? "Removing..." : "Remove"}
          </button>
        </div>

        <div className="rounded-xl bg-white/80 border border-green-200 px-3 py-2 text-sm font-body text-green-900">
          <span className="text-green-700">Total updated:</span>{" "}
          <span className="line-through opacity-70">{formatCurrency(applied.originalAmount, currency)}</span>{" "}
          <span className="font-semibold">{formatCurrency(applied.finalAmount, currency)}</span>
        </div>

        {removeError && <p className="text-xs text-red-600">{removeError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (promoError) clear();
          }}
          placeholder="Promo code"
          disabled={isLoading}
          className="flex-1 rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-pink-vivid)] disabled:opacity-60"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleApply();
            }
          }}
        />
        <button
          onClick={handleApply}
          disabled={isLoading || !code.trim()}
          className="rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid px-5 py-3 text-sm font-ui font-semibold text-white disabled:opacity-60"
        >
          {isLoading ? "Applying..." : "Apply"}
        </button>
      </div>
      {promoError && <p className="text-xs text-red-600">{promoError}</p>}
    </div>
  );
}

// ============================================================================
// STRIPE INLINE FORM
// ============================================================================

function StripeInlineForm({ orderId, amount, currency, onSuccess }: { orderId: string; amount: number; currency: string; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    try {
      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/${orderId}?payment=success`,
        },
        redirect: "if_required",
      });

      if (stripeError) {
        setError(stripeError.message || "Payment failed");
        setProcessing(false);
        return;
      }

      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: await buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ order_id: orderId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Payment confirmation failed");
        setProcessing(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full rounded-xl bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm px-6 py-3 text-sm font-ui font-semibold text-white disabled:opacity-60"
      >
        {processing ? "Processing..." : `Pay ${formatCurrency(amount, currency)}`}
      </button>
    </form>
  );
}

// ============================================================================
// PAYPAL INLINE BUTTONS
// ============================================================================

function PayPalInlineButtons({
  orderId,
  paypalOrderId,
  onSuccess,
}: {
  orderId: string;
  paypalOrderId: string;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  return (
    <div className="space-y-4">
      <PayPalButtons
        style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 50 }}
        createOrder={async () => paypalOrderId}
        onApprove={async () => {
          setProcessing(true);
          setError(null);
          try {
            const res = await fetch("/api/payments/confirm", {
              method: "POST",
              headers: await buildAuthHeaders({ "Content-Type": "application/json" }),
              body: JSON.stringify({ order_id: orderId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Capture failed");
            onSuccess();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment failed");
            setProcessing(false);
          }
        }}
        onCancel={() => setError("Payment was cancelled.")}
        onError={(err) => {
          console.error("[PayPal Error]", err);
          setError(err instanceof Error ? err.message : "PayPal encountered an error.");
        }}
        disabled={processing}
      />

      {processing && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-[var(--color-purple-primary)]" />
          Processing...
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}

// ============================================================================
// MAIN CHECKOUT PAGE
// ============================================================================

export default function CheckoutPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { order, loading: orderLoading, error: orderError, setOrder } = useOrderData(orderId);
  const {
    mode,
    clientSecret,
    paypalOrderId,
    loading: checkoutLoading,
    error: checkoutError,
    createCheckout,
    confirmPayment,
  } = useCheckout();
  const { updateDraft, updating: updatingDraft, error: updateDraftError } = useUpdateOrderDraft();

  const [stripeReady, setStripeReady] = useState(false);
  const [displayAmount, setDisplayAmount] = useState<number | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [confirmingZeroTotal, setConfirmingZeroTotal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shippingSavedNotice, setShippingSavedNotice] = useState<string | null>(null);
  const [shippingDraft, setShippingDraft] = useState<Partial<ShippingAddress>>({
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  });

  useEffect(() => {
    setShippingSavedNotice(null);
  }, [orderId]);

  useEffect(() => {
    if (order) {
      setDisplayAmount(Number(order.amount));
      setDiscountAmount(Number(order.discount_amount || 0));
      setShippingDraft({
        name: order.shipping_address?.name || "",
        line1: order.shipping_address?.line1 || "",
        line2: order.shipping_address?.line2 || "",
        city: order.shipping_address?.city || "",
        state: order.shipping_address?.state || "",
        postal_code: order.shipping_address?.postal_code || "",
        country: order.shipping_address?.country || "",
      });
      setShippingError(null);
    }
  }, [order]);

  useEffect(() => {
    if (!order || order.status !== "pending_payment") return;

    const requiresShippingDetails =
      order.listing_type === "product"
      && order.product?.delivery_type !== "digital"
      && !order.shipping_address;

    if (!requiresShippingDetails) {
      createCheckout(order.id);
    }
  }, [order, createCheckout]);

  useEffect(() => {
    if (mode !== "stripe") return;
    getStripe().then((stripe) => {
      if (stripe) setStripeReady(true);
    });
  }, [mode]);

  const handleSuccess = useCallback(() => {
    router.push(`/orders/${orderId}?payment=success`);
  }, [router, orderId]);

  const handleSaveShippingDetails = useCallback(async () => {
    if (!order) return;

    const payload: ShippingAddress = {
      name: (shippingDraft.name || "").trim(),
      line1: (shippingDraft.line1 || "").trim(),
      line2: (shippingDraft.line2 || "").trim() || undefined,
      city: (shippingDraft.city || "").trim(),
      state: (shippingDraft.state || "").trim() || undefined,
      postal_code: (shippingDraft.postal_code || "").trim(),
      country: (shippingDraft.country || "").trim(),
    };

    if (!payload.name || !payload.line1 || !payload.city || !payload.country) {
      setShippingError("Name, address, city, and country are required for shipping.");
      return;
    }

    setShippingError(null);
    setShippingSavedNotice(null);

    const success = await updateDraft({
      order_id: order.id,
      shipping_address: payload,
    });

    if (!success) {
      setShippingError(updateDraftError || "Unable to save shipping details right now.");
      return;
    }

    setOrder((prev) => (prev ? { ...prev, shipping_address: payload } : prev));
    setShippingSavedNotice("Shipping details saved.");
  }, [order, setOrder, shippingDraft, updateDraft, updateDraftError]);

  if (authLoading || orderLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-[var(--color-purple-primary)]" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (orderError || !order) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h2 className="mb-2 text-xl font-display text-ink">Order Not Found</h2>
        <p className="text-sm font-body text-muted">{orderError || "This order does not exist."}</p>
      </div>
    );
  }

  if (order.buyer_id !== user.id) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h2 className="mb-2 text-xl font-display text-ink">Not Authorized</h2>
        <p className="text-sm font-body text-muted">You do not have access to this order.</p>
      </div>
    );
  }

  if (order.status !== "pending_payment") {
    router.push(`/orders/${orderId}`);
    return null;
  }

  const amount = Math.max(displayAmount ?? Number(order.amount), 0);
  const shippingCost = Number(order.shipping_cost || 0);
  const originalAmount = Number(order.original_amount ?? Number(order.amount) + Number(order.discount_amount || 0));
  const effectiveDiscount = Math.max(discountAmount || Number(order.discount_amount || 0), 0);
  const subtotal = Math.max(originalAmount - shippingCost, 0);
  const zeroTotal = amount <= 0;
  const isPhysicalProduct =
    order.listing_type === "product"
    && order.product?.delivery_type !== "digital";
  const requiresShippingDetails = isPhysicalProduct && !order.shipping_address;
  const paymentStepLabel = isPhysicalProduct ? "Step 3" : "Step 2";

  const productImage =
    order.product?.media?.find((item: { is_primary: boolean }) => item.is_primary)?.media_url ||
    order.product?.media?.[0]?.media_url;

  const paypalClientId = getPayPalClientId();
  const currency = order.currency || "USD";

  const elementsOptions: StripeElementsOptions | undefined = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#8e44ad",
            borderRadius: "10px",
          },
        },
      }
    : undefined;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff4fb_0%,#ffffff_45%,#fff9f0_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <header className="mb-6 sm:mb-8">
          <p className="text-xs font-ui uppercase tracking-[0.16em] text-pink-vivid">Checkout</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-display text-ink">Complete Your Order</h1>
          <p className="mt-2 max-w-2xl text-sm font-body text-muted">
            Apply promo codes, review your total, and finish payment securely.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_380px]">
          <section className="rounded-3xl border border-black/[0.08] bg-white/90 backdrop-blur p-5 sm:p-6 space-y-6">
            <div className="rounded-2xl border border-black/[0.06] bg-[linear-gradient(135deg,rgba(142,68,173,0.08),rgba(255,0,127,0.06),rgba(255,159,67,0.08))] p-4">
              <p className="text-xs font-ui uppercase tracking-[0.14em] text-muted">Step 1</p>
              <h2 className="mt-1 text-lg font-display text-ink">Promo Code</h2>
              <p className="text-sm font-body text-muted mt-1">If you have a code, apply it before payment.</p>
              <div className="mt-4">
                <PromoCodeSection
                  orderId={order.id}
                  orderAmount={originalAmount}
                  listingType={order.listing_type}
                  currency={currency}
                  onApplied={(discount, final) => {
                    setDiscountAmount(discount);
                    setDisplayAmount(final);
                    setActionError(null);
                  }}
                  onCheckoutRefresh={() => (requiresShippingDetails ? undefined : createCheckout(order.id))}
                />
              </div>
            </div>

            {isPhysicalProduct && (
              <div className="rounded-2xl border border-black/[0.06] p-4 sm:p-5">
                <p className="text-xs font-ui uppercase tracking-[0.14em] text-muted">Step 2</p>
                <h2 className="mt-1 text-lg font-display text-ink">Shipping Details</h2>
                <p className="mt-1 text-sm font-body text-muted">
                  Where should this piece be delivered?
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={shippingDraft.name || ""}
                    onChange={(event) => {
                      setShippingDraft((prev) => ({ ...prev, name: event.target.value }));
                      if (shippingError) setShippingError(null);
                    }}
                    placeholder="Full name"
                    className="rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-pink-vivid)]"
                  />
                  <input
                    type="text"
                    value={shippingDraft.line1 || ""}
                    onChange={(event) => {
                      setShippingDraft((prev) => ({ ...prev, line1: event.target.value }));
                      if (shippingError) setShippingError(null);
                    }}
                    placeholder="Address line 1"
                    className="rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-pink-vivid)]"
                  />
                  <input
                    type="text"
                    value={shippingDraft.line2 || ""}
                    onChange={(event) => setShippingDraft((prev) => ({ ...prev, line2: event.target.value }))}
                    placeholder="Address line 2 (optional)"
                    className="rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-pink-vivid)]"
                  />
                  <input
                    type="text"
                    value={shippingDraft.city || ""}
                    onChange={(event) => {
                      setShippingDraft((prev) => ({ ...prev, city: event.target.value }));
                      if (shippingError) setShippingError(null);
                    }}
                    placeholder="City"
                    className="rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-pink-vivid)]"
                  />
                  <input
                    type="text"
                    value={shippingDraft.state || ""}
                    onChange={(event) => setShippingDraft((prev) => ({ ...prev, state: event.target.value }))}
                    placeholder="State / Region (optional)"
                    className="rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-pink-vivid)]"
                  />
                  <input
                    type="text"
                    value={shippingDraft.postal_code || ""}
                    onChange={(event) => setShippingDraft((prev) => ({ ...prev, postal_code: event.target.value }))}
                    placeholder="Postal code (optional)"
                    className="rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-pink-vivid)]"
                  />
                  <input
                    type="text"
                    value={shippingDraft.country || ""}
                    onChange={(event) => {
                      setShippingDraft((prev) => ({ ...prev, country: event.target.value }));
                      if (shippingError) setShippingError(null);
                    }}
                    placeholder="Country"
                    className="sm:col-span-2 rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-pink-vivid)]"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSaveShippingDetails}
                    disabled={updatingDraft}
                    className="rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid px-5 py-3 text-sm font-ui font-semibold text-white disabled:opacity-60"
                  >
                    {updatingDraft
                      ? "Saving..."
                      : order.shipping_address
                      ? "Update Shipping Details"
                      : "Save Shipping Details"}
                  </button>
                  {order.shipping_address && (
                    <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-ui font-semibold text-green-700">
                      Saved
                    </span>
                  )}
                </div>

                {requiresShippingDetails && (
                  <p className="mt-3 text-xs font-body text-amber-700">
                    Save your shipping details to unlock payment methods.
                  </p>
                )}
                {shippingSavedNotice && (
                  <p className="mt-3 text-xs font-body text-green-700">{shippingSavedNotice}</p>
                )}
                {(shippingError || updateDraftError) && (
                  <p className="mt-3 text-xs font-body text-red-600">{shippingError || updateDraftError}</p>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-black/[0.06] p-4 sm:p-5">
              <p className="text-xs font-ui uppercase tracking-[0.14em] text-muted">{paymentStepLabel}</p>
              <h2 className="mt-1 text-lg font-display text-ink">Payment</h2>

              {requiresShippingDetails && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-ui font-semibold text-amber-900">Shipping details required</p>
                  <p className="mt-1 text-xs font-body text-amber-800">
                    Save your shipping details above to continue with payment.
                  </p>
                </div>
              )}

              {checkoutLoading && !requiresShippingDetails && (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/20 border-t-[var(--color-purple-primary)]" />
                </div>
              )}

              {checkoutError && !requiresShippingDetails && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-body text-red-700">{checkoutError}</p>
                  <button
                    onClick={() => {
                      setActionError(null);
                      createCheckout(order.id);
                    }}
                    className="mt-2 text-sm font-ui font-semibold text-red-700 underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              {actionError && !requiresShippingDetails && <p className="mt-4 text-sm text-red-600">{actionError}</p>}

              {!requiresShippingDetails && mode === "stripe" && clientSecret && stripeReady && elementsOptions && !checkoutLoading && !checkoutError && (
                <div className="mt-4">
                  <Elements stripe={getStripe()} options={elementsOptions}>
                    <StripeInlineForm
                      orderId={order.id}
                      amount={amount}
                      currency={currency}
                      onSuccess={handleSuccess}
                    />
                  </Elements>
                </div>
              )}

              {!requiresShippingDetails && mode === "paypal" && paypalOrderId && paypalClientId && !checkoutLoading && !checkoutError && (
                <div className="mt-4">
                  <PayPalScriptProvider
                    options={{
                      clientId: paypalClientId,
                      currency: currency.toUpperCase(),
                      intent: order.listing_type === "service" ? "authorize" : "capture",
                    }}
                  >
                    <PayPalInlineButtons
                      orderId={order.id}
                      paypalOrderId={paypalOrderId}
                      onSuccess={handleSuccess}
                    />
                  </PayPalScriptProvider>
                </div>
              )}

              {!requiresShippingDetails && mode === "placeholder" && !checkoutLoading && !checkoutError && (
                <div className="mt-4 space-y-4">
                  {zeroTotal ? (
                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                      <p className="text-sm font-ui font-semibold text-green-800">
                        {effectiveDiscount > 0 ? "Promo applied. Your total is now $0.00." : "No payment required for this order."}
                      </p>
                      <p className="mt-1 text-xs font-body text-green-700">
                        Complete the order and continue normally.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-ui font-semibold text-amber-900">Payment provider fallback</p>
                      <p className="mt-1 text-xs font-body text-amber-800">
                        We couldn&apos;t initialize a card/wallet checkout for this order. Use secure fallback confirmation to continue.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={async () => {
                      setActionError(null);
                      setConfirmingZeroTotal(true);
                      const success = await confirmPayment(order.id);
                      setConfirmingZeroTotal(false);
                      if (success) {
                        handleSuccess();
                      } else {
                        setActionError("Unable to confirm payment right now. Please try again.");
                      }
                    }}
                    disabled={confirmingZeroTotal}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm px-6 py-3 text-sm font-ui font-semibold text-white disabled:opacity-60"
                  >
                    {confirmingZeroTotal ? "Confirming..." : zeroTotal ? "Complete Order" : "Confirm Payment"}
                  </button>
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-3xl border border-black/[0.08] bg-white/95 p-5 sm:p-6 xl:sticky xl:top-8 h-fit">
            <h2 className="text-lg font-display text-ink">Order Summary</h2>

            <div className="mt-4 flex gap-3">
              {productImage && (
                <img
                  src={productImage as string}
                  alt=""
                  className="h-16 w-16 rounded-xl object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-ui font-semibold text-ink truncate">{order.product?.title || "Order"}</p>
                <p className="mt-0.5 text-xs font-body text-muted">
                  {order.listing_type === "service" ? "Commission" : "Product"}
                </p>
                {order.product?.seller && (
                  <p className="mt-0.5 text-xs font-body text-muted">
                    by @{(order.product.seller as { username: string }).username}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 space-y-2 text-sm font-body">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="text-ink">{formatCurrency(subtotal, currency)}</span>
              </div>

              {shippingCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">Shipping</span>
                  <span className="text-ink">{formatCurrency(shippingCost, currency)}</span>
                </div>
              )}

              {effectiveDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(effectiveDiscount, currency)}</span>
                </div>
              )}

              <div className="flex justify-between text-xs text-muted">
                <span>Platform fee</span>
                <span>{formatCurrency(Number(order.platform_fee), currency)}</span>
              </div>

              <div className="border-t border-black/[0.08] pt-2 flex justify-between text-base font-ui font-semibold text-ink">
                <span>Total</span>
                <span>{formatCurrency(amount, currency)}</span>
              </div>
            </div>

            {zeroTotal && effectiveDiscount > 0 && (
              <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-body text-green-800">
                Your promo covered the full total. Complete order to continue.
              </div>
            )}

            {order.listing_type === "service" && (
              <p className="mt-4 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 text-xs font-body text-muted">
                Commission payments are held in escrow and released after you approve delivery.
              </p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
