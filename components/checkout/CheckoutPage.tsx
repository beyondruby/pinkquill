"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { getStripe } from "@/lib/stripe-client";
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

const REQUIRED_SHIPPING_FIELDS = ["name", "line1", "city", "country"] as const;
type RequiredShippingField = (typeof REQUIRED_SHIPPING_FIELDS)[number];
type ShippingValidationField = RequiredShippingField | "buyer_phone";

function normalizeShippingAddress(address?: Partial<ShippingAddress> | null): ShippingAddress {
  return {
    name: String(address?.name || "").trim(),
    line1: String(address?.line1 || "").trim(),
    line2: String(address?.line2 || "").trim(),
    city: String(address?.city || "").trim(),
    state: String(address?.state || "").trim(),
    postal_code: String(address?.postal_code || "").trim(),
    country: String(address?.country || "").trim(),
  };
}

function hasRequiredShippingAddress(address?: Partial<ShippingAddress> | null): boolean {
  const normalized = normalizeShippingAddress(address);
  return REQUIRED_SHIPPING_FIELDS.every((field) => normalized[field].length > 0);
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
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-purple-primary)] disabled:opacity-60"
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
// MAIN CHECKOUT PAGE
// ============================================================================

export default function CheckoutPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { order, loading: orderLoading, error: orderError, setOrder } = useOrderData(orderId);
  const {
    mode,
    clientSecret,
    loading: checkoutLoading,
    error: checkoutError,
    createCheckout,
    confirmPayment,
  } = useCheckout();
  const { updateDraft, updating: updatingDraft } = useUpdateOrderDraft();

  const [stripeReady, setStripeReady] = useState(false);
  const [promoOverrides, setPromoOverrides] = useState<Record<string, { amount: number; discount: number }>>({});
  const [confirmingZeroTotal, setConfirmingZeroTotal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shippingFieldErrors, setShippingFieldErrors] = useState<Partial<Record<ShippingValidationField, string>>>({});
  const [shippingSavedNotices, setShippingSavedNotices] = useState<Record<string, string>>({});
  const [shippingDraftEdits, setShippingDraftEdits] = useState<Record<string, Partial<ShippingAddress>>>({});
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerNote, setBuyerNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);

  const promoOverride = promoOverrides[orderId];
  const shippingSavedNotice = shippingSavedNotices[orderId] || null;
  const shippingDraft = useMemo<Partial<ShippingAddress>>(() => {
    const shippingAddress = order?.shipping_address;
    const edits = shippingDraftEdits[orderId] || {};
    return {
      name: edits.name ?? shippingAddress?.name ?? "",
      line1: edits.line1 ?? shippingAddress?.line1 ?? "",
      line2: edits.line2 ?? shippingAddress?.line2 ?? "",
      city: edits.city ?? shippingAddress?.city ?? "",
      state: edits.state ?? shippingAddress?.state ?? "",
      postal_code: edits.postal_code ?? shippingAddress?.postal_code ?? "",
      country: edits.country ?? shippingAddress?.country ?? "",
    };
  }, [order?.shipping_address, orderId, shippingDraftEdits]);

  const setShippingField = useCallback((field: keyof ShippingAddress, value: string) => {
    setShippingDraftEdits((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [field]: value,
      },
    }));
  }, [orderId]);

  const setShippingSavedNotice = useCallback((message: string | null) => {
    setShippingSavedNotices((prev) => {
      if (!message) {
        const next = { ...prev };
        delete next[orderId];
        return next;
      }
      return { ...prev, [orderId]: message };
    });
  }, [orderId]);

  const handleShippingFieldChange = useCallback((field: keyof ShippingAddress, value: string) => {
    setShippingField(field, value);
    setShippingSavedNotice(null);
    if (shippingError) setShippingError(null);
    setShippingFieldErrors((prev) => {
      if (!REQUIRED_SHIPPING_FIELDS.includes(field as RequiredShippingField)) return prev;
      const requiredField = field as RequiredShippingField;
      if (!prev[requiredField]) return prev;
      const next = { ...prev };
      delete next[requiredField];
      return next;
    });
  }, [setShippingField, setShippingSavedNotice, shippingError]);

  const handlePhoneChange = useCallback((value: string) => {
    setBuyerPhone(value);
    setShippingSavedNotice(null);
    if (shippingError) setShippingError(null);
    setShippingFieldErrors((prev) => {
      if (!prev.buyer_phone) return prev;
      const next = { ...prev };
      delete next.buyer_phone;
      return next;
    });
  }, [setShippingSavedNotice, shippingError]);

  // Initialize phone and note from order data
  useEffect(() => {
    if (!order) return;
    if (order.buyer_phone && !buyerPhone) setBuyerPhone(order.buyer_phone);
    if (order.buyer_note && !buyerNote) setBuyerNote(order.buyer_note);
    setNoteSaved(false);
    setNoteSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  useEffect(() => {
    if (!order || order.status !== "pending_payment") return;

    const requiresShippingDetails =
      order.listing_type === "product"
      && order.product?.delivery_type !== "digital"
      && (
        !hasRequiredShippingAddress(order.shipping_address)
        || !String(order.buyer_phone || "").trim()
      );

    if (!requiresShippingDetails) {
      createCheckout(order.id);
    }
  }, [order, createCheckout]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!order || !user || order.buyer_id !== user.id) return;
    if (order.status !== "pending_payment") {
      router.replace(`/orders/${orderId}`);
    }
  }, [order, orderId, router, user]);

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

    const normalizedPayload = normalizeShippingAddress(shippingDraft);
    const payload: ShippingAddress = {
      ...normalizedPayload,
      line2: normalizedPayload.line2 || undefined,
      state: normalizedPayload.state || undefined,
    };
    const trimmedPhone = buyerPhone.trim();
    const fieldErrors: Partial<Record<ShippingValidationField, string>> = {};

    for (const field of REQUIRED_SHIPPING_FIELDS) {
      if (!normalizedPayload[field]) {
        fieldErrors[field] = "Required";
      }
    }
    if (!trimmedPhone) {
      fieldErrors.buyer_phone = "Required";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setShippingFieldErrors(fieldErrors);
      setShippingError("Complete all required shipping fields to continue.");
      return;
    }

    setShippingFieldErrors({});
    setShippingError(null);
    setShippingSavedNotice(null);

    const success = await updateDraft({
      order_id: order.id,
      shipping_address: payload,
      buyer_phone: trimmedPhone,
    });

    if (!success) {
      setShippingError("Unable to save shipping details right now.");
      return;
    }

    setOrder((prev) => (prev ? { ...prev, shipping_address: payload, buyer_phone: trimmedPhone } : prev));
    setShippingDraftEdits((prev) => {
      if (!(orderId in prev)) return prev;
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    setShippingSavedNotice("Shipping details saved.");
  }, [order, orderId, setOrder, setShippingSavedNotice, shippingDraft, updateDraft, buyerPhone]);

  if (authLoading || orderLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-[var(--color-purple-primary)]" />
      </div>
    );
  }

  if (!user) {
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
    return null;
  }

  const amount = Math.max(promoOverride?.amount ?? Number(order.amount), 0);
  const shippingCost = Number(order.shipping_cost || 0);
  const originalAmount = Number(order.original_amount ?? Number(order.amount) + Number(order.discount_amount || 0));
  const effectiveDiscount = Math.max(promoOverride?.discount ?? Number(order.discount_amount || 0), 0);
  const subtotal = Math.max(originalAmount - shippingCost, 0);
  const zeroTotal = amount <= 0;
  const isPhysicalProduct =
    order.listing_type === "product"
    && order.product?.delivery_type !== "digital";
  const shippingAddressComplete = hasRequiredShippingAddress(order.shipping_address);
  const shippingPhoneComplete = String(order.buyer_phone || "").trim().length > 0;
  const requiresShippingDetails = isPhysicalProduct && (!shippingAddressComplete || !shippingPhoneComplete);
  const shippingReady = !isPhysicalProduct || (shippingAddressComplete && shippingPhoneComplete);
  const paymentReady = !requiresShippingDetails;
  const paymentStepLabel = isPhysicalProduct ? "Step 3" : "Step 2";
  const noteHasChanges = buyerNote.trim() !== String(order.buyer_note || "").trim();
  const shippingHasChanges = isPhysicalProduct
    ? (
      JSON.stringify(normalizeShippingAddress(shippingDraft)) !== JSON.stringify(normalizeShippingAddress(order.shipping_address))
      || buyerPhone.trim() !== String(order.buyer_phone || "").trim()
    )
    : false;
  const checkoutIntro = isPhysicalProduct
    ? "Review your promo, confirm delivery details, and pay securely."
    : "Apply promo and pay securely. Digital delivery is instant after payment.";
  const deliveryLabel = isPhysicalProduct ? "Physical delivery" : "Digital delivery";

  const productImage =
    order.product?.media?.find((item: { is_primary: boolean }) => item.is_primary)?.media_url ||
    order.product?.media?.[0]?.media_url;

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
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(170deg,#fff7fc_0%,#ffffff_42%,#fff8ef_100%)]">
      <div className="pointer-events-none absolute -top-28 -left-16 h-72 w-72 rounded-full bg-pink-vivid/10 blur-3xl" />
      <div className="pointer-events-none absolute top-28 -right-24 h-80 w-80 rounded-full bg-purple-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-orange-warm/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <header className="mb-6 sm:mb-8 rounded-3xl border border-black/[0.08] bg-white/80 backdrop-blur px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-ui uppercase tracking-[0.16em] text-pink-vivid">Checkout</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-display text-ink">Complete Your Order</h1>
              <p className="mt-2 max-w-2xl text-sm font-body text-muted">
                {checkoutIntro}
              </p>
              <p className="mt-2 inline-flex rounded-full border border-black/[0.08] bg-white px-3 py-1 text-[11px] font-ui uppercase tracking-[0.12em] text-muted">
                {deliveryLabel}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-pink-vivid/25 bg-pink-vivid/10 px-3 py-1 text-[11px] font-ui uppercase tracking-[0.12em] text-pink-vivid">
                1 Promo
              </span>
              {isPhysicalProduct && (
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-ui uppercase tracking-[0.12em] ${
                    shippingReady
                      ? "border-green-300 bg-green-50 text-green-700"
                      : "border-amber-300 bg-amber-50 text-amber-700"
                  }`}
                >
                  2 Shipping
                </span>
              )}
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-ui uppercase tracking-[0.12em] ${
                  paymentReady
                    ? "border-purple-primary/25 bg-purple-primary/10 text-purple-primary"
                    : "border-black/[0.12] bg-black/[0.03] text-muted"
                }`}
              >
                {isPhysicalProduct ? "3 Payment" : "2 Payment"}
              </span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.05fr)_380px]">
          <section className="rounded-3xl border border-black/[0.08] bg-white/90 backdrop-blur p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] space-y-6">
            <div className="rounded-2xl border border-black/[0.06] bg-[linear-gradient(130deg,rgba(255,255,255,0.97),rgba(255,246,252,0.95),rgba(255,251,246,0.95))] p-4 sm:p-5">
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
                    setPromoOverrides((prev) => ({
                      ...prev,
                      [order.id]: {
                        amount: final,
                        discount,
                      },
                    }));
                    setActionError(null);
                  }}
                  onCheckoutRefresh={() => (requiresShippingDetails ? undefined : createCheckout(order.id))}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-black/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(255,252,246,0.95),rgba(255,248,252,0.95))] p-4 sm:p-5">
              <h2 className="text-lg font-display text-ink">Note to Seller</h2>
              <p className="text-sm font-body text-muted mt-1">Optional — add a message for the seller about your order.</p>
              <div className="mt-3">
                <label htmlFor="buyer-note" className="text-xs font-ui uppercase tracking-[0.12em] text-muted">
                  Message
                </label>
                <textarea
                  id="buyer-note"
                  value={buyerNote}
                  onChange={(event) => {
                    const val = event.target.value;
                    setBuyerNote(val);
                    setNoteSaved(false);
                    setNoteSaveError(null);
                    if (val.length > 500) {
                      setNoteError("Note must be 500 characters or less.");
                    } else {
                      setNoteError(null);
                    }
                  }}
                  placeholder="Any special requests, details, or instructions..."
                  maxLength={500}
                  rows={3}
                  aria-invalid={!!noteError}
                  className={`mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-purple-primary)] resize-none ${
                    noteError ? "border-red-300" : "border-gray-200"
                  }`}
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className={`text-xs font-body ${buyerNote.length > 500 ? "text-red-500" : "text-muted"}`}>
                    {buyerNote.length}/500
                  </p>
                  <button
                    onClick={async () => {
                      if (buyerNote.length > 500 || !order || !noteHasChanges) return;
                      setNoteSaveError(null);
                      const success = await updateDraft({ order_id: order.id, buyer_note: buyerNote.trim() });
                      if (success) {
                        setOrder((prev) => (prev ? { ...prev, buyer_note: buyerNote.trim() || null } : prev));
                        setNoteSaved(true);
                        return;
                      }
                      setNoteSaveError("Unable to save your note right now.");
                    }}
                    disabled={updatingDraft || buyerNote.length > 500 || !noteHasChanges}
                    className="rounded-lg border border-black/[0.12] px-3 py-1.5 text-xs font-ui font-semibold text-muted hover:text-ink hover:border-black/20 disabled:opacity-50"
                  >
                    {updatingDraft ? "Saving..." : "Save Note"}
                  </button>
                </div>
                {noteHasChanges && !noteSaved && (
                  <p className="text-xs text-amber-700 mt-1">You have unsaved note changes.</p>
                )}
                {noteError && <p className="text-xs text-red-600 mt-1">{noteError}</p>}
                {noteSaveError && <p className="text-xs text-red-600 mt-1">{noteSaveError}</p>}
                {noteSaved && <p className="text-xs text-green-700 mt-1">Note saved.</p>}
              </div>
            </div>

            {isPhysicalProduct && (
              <div className="rounded-2xl border border-black/[0.06] bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(245,250,255,0.94))] p-4 sm:p-5">
                <p className="text-xs font-ui uppercase tracking-[0.14em] text-muted">Step 2</p>
                <h2 className="mt-1 text-lg font-display text-ink">Shipping Details</h2>
                <p className="mt-1 text-sm font-body text-muted">
                  Where should this piece be delivered?
                </p>

                <p className="mt-3 text-xs font-body text-muted">Fields marked * are required before payment.</p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="shipping-name" className="text-xs font-ui uppercase tracking-[0.12em] text-muted">
                      Full name *
                    </label>
                    <input
                      id="shipping-name"
                      type="text"
                      autoComplete="name"
                      value={shippingDraft.name || ""}
                      onChange={(event) => handleShippingFieldChange("name", event.target.value)}
                      placeholder="Full name"
                      aria-invalid={!!shippingFieldErrors.name}
                      className={`rounded-lg border bg-white px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-purple-primary)] ${
                        shippingFieldErrors.name ? "border-red-300" : "border-gray-200"
                      }`}
                    />
                    {shippingFieldErrors.name && <p className="text-xs text-red-600">{shippingFieldErrors.name}</p>}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="shipping-line1" className="text-xs font-ui uppercase tracking-[0.12em] text-muted">
                      Address line 1 *
                    </label>
                    <input
                      id="shipping-line1"
                      type="text"
                      autoComplete="address-line1"
                      value={shippingDraft.line1 || ""}
                      onChange={(event) => handleShippingFieldChange("line1", event.target.value)}
                      placeholder="Street address"
                      aria-invalid={!!shippingFieldErrors.line1}
                      className={`rounded-lg border bg-white px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-purple-primary)] ${
                        shippingFieldErrors.line1 ? "border-red-300" : "border-gray-200"
                      }`}
                    />
                    {shippingFieldErrors.line1 && <p className="text-xs text-red-600">{shippingFieldErrors.line1}</p>}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="shipping-line2" className="text-xs font-ui uppercase tracking-[0.12em] text-muted">
                      Address line 2
                    </label>
                    <input
                      id="shipping-line2"
                      type="text"
                      autoComplete="address-line2"
                      value={shippingDraft.line2 || ""}
                      onChange={(event) => handleShippingFieldChange("line2", event.target.value)}
                      placeholder="Apartment, suite, etc. (optional)"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-purple-primary)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="shipping-city" className="text-xs font-ui uppercase tracking-[0.12em] text-muted">
                      City *
                    </label>
                    <input
                      id="shipping-city"
                      type="text"
                      autoComplete="address-level2"
                      value={shippingDraft.city || ""}
                      onChange={(event) => handleShippingFieldChange("city", event.target.value)}
                      placeholder="City"
                      aria-invalid={!!shippingFieldErrors.city}
                      className={`rounded-lg border bg-white px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-purple-primary)] ${
                        shippingFieldErrors.city ? "border-red-300" : "border-gray-200"
                      }`}
                    />
                    {shippingFieldErrors.city && <p className="text-xs text-red-600">{shippingFieldErrors.city}</p>}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="shipping-state" className="text-xs font-ui uppercase tracking-[0.12em] text-muted">
                      State / Region
                    </label>
                    <input
                      id="shipping-state"
                      type="text"
                      autoComplete="address-level1"
                      value={shippingDraft.state || ""}
                      onChange={(event) => handleShippingFieldChange("state", event.target.value)}
                      placeholder="State / Region (optional)"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-purple-primary)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="shipping-postal" className="text-xs font-ui uppercase tracking-[0.12em] text-muted">
                      Postal code
                    </label>
                    <input
                      id="shipping-postal"
                      type="text"
                      autoComplete="postal-code"
                      value={shippingDraft.postal_code || ""}
                      onChange={(event) => handleShippingFieldChange("postal_code", event.target.value)}
                      placeholder="Postal code (optional)"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-purple-primary)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="shipping-country" className="text-xs font-ui uppercase tracking-[0.12em] text-muted">
                      Country *
                    </label>
                    <input
                      id="shipping-country"
                      type="text"
                      autoComplete="country-name"
                      value={shippingDraft.country || ""}
                      onChange={(event) => handleShippingFieldChange("country", event.target.value)}
                      placeholder="Country"
                      aria-invalid={!!shippingFieldErrors.country}
                      className={`rounded-lg border bg-white px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-purple-primary)] ${
                        shippingFieldErrors.country ? "border-red-300" : "border-gray-200"
                      }`}
                    />
                    {shippingFieldErrors.country && <p className="text-xs text-red-600">{shippingFieldErrors.country}</p>}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="shipping-phone" className="text-xs font-ui uppercase tracking-[0.12em] text-muted">
                      Phone number *
                    </label>
                    <input
                      id="shipping-phone"
                      type="tel"
                      autoComplete="tel"
                      value={buyerPhone}
                      onChange={(event) => handlePhoneChange(event.target.value)}
                      placeholder="Phone number"
                      aria-invalid={!!shippingFieldErrors.buyer_phone}
                      className={`rounded-lg border bg-white px-3 py-2 text-sm font-body text-ink placeholder:text-muted outline-none focus:border-[var(--color-purple-primary)] ${
                        shippingFieldErrors.buyer_phone ? "border-red-300" : "border-gray-200"
                      }`}
                    />
                    {shippingFieldErrors.buyer_phone && <p className="text-xs text-red-600">{shippingFieldErrors.buyer_phone}</p>}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSaveShippingDetails}
                    disabled={updatingDraft || !shippingHasChanges}
                    className="rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid px-5 py-3 text-sm font-ui font-semibold text-white disabled:opacity-60"
                  >
                    {updatingDraft
                      ? "Saving..."
                      : order.shipping_address
                      ? "Update Shipping Details"
                      : "Save Shipping Details"}
                  </button>
                  {!shippingHasChanges && (
                    <span className="text-xs font-body text-muted">No unsaved shipping changes.</span>
                  )}
                  {shippingReady && (
                    <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-ui font-semibold text-green-700">
                      Saved
                    </span>
                  )}
                  {!shippingReady && order.shipping_address && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-ui font-semibold text-amber-700">
                      Address saved, phone needed
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
                {shippingError && <p className="mt-3 text-xs font-body text-red-600">{shippingError}</p>}
              </div>
            )}

            <div className="rounded-2xl border border-black/[0.06] bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(249,248,255,0.95))] p-4 sm:p-5">
              <p className="text-xs font-ui uppercase tracking-[0.14em] text-muted">{paymentStepLabel}</p>
              <h2 className="mt-1 text-lg font-display text-ink">Payment</h2>

              {!isPhysicalProduct && (
                <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-sm font-ui font-semibold text-sky-900">Digital delivery enabled</p>
                  <p className="mt-1 text-xs font-body text-sky-800">
                    No shipping details are required. Your files will be available after payment confirmation.
                  </p>
                </div>
              )}

              {requiresShippingDetails && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-ui font-semibold text-amber-900">Shipping details required</p>
                  <p className="mt-1 text-xs font-body text-amber-800">
                    Save your shipping details above to continue with payment.
                  </p>
                </div>
              )}

              {checkoutLoading && !requiresShippingDetails && (
                <div className="flex items-center justify-center rounded-xl border border-black/[0.06] bg-white/80 py-10">
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

          <aside className="rounded-3xl border border-black/[0.08] bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(254,249,255,0.97))] p-5 sm:p-6 xl:sticky xl:top-8 h-fit shadow-[0_20px_60px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display text-ink">Order Summary</h2>
              <span className="rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-[10px] font-ui uppercase tracking-[0.14em] text-muted">
                {order.order_number}
              </span>
            </div>

            <div className="mt-4 flex gap-3">
              {productImage && (
                <img
                  src={productImage as string}
                  alt={order.product?.title ? `${order.product.title} preview` : "Product preview"}
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
                <p className="mt-0.5 text-xs font-body text-muted">{deliveryLabel}</p>
              </div>
            </div>

            {isPhysicalProduct && (
              <div
                className={`mt-4 rounded-xl border px-3 py-2 text-xs font-body ${
                  shippingReady
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {shippingReady
                  ? "Shipping details are complete."
                  : "Shipping address and phone are required before payment."}
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-black/[0.06] bg-white/90 p-4 space-y-2 text-sm font-body">
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

            {!zeroTotal && (
              <p className="mt-4 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 text-xs font-body text-muted">
                Secure checkout: your payment details are processed by trusted providers and never stored in plain text.
              </p>
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
