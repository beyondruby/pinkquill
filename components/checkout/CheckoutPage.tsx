"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import TurnstileCaptcha from "@/components/security/TurnstileCaptcha";
import { buildAuthenticatedHeaders } from "@/lib/auth-client";
import { getStripe } from "@/lib/stripe-client";
import { useAuth } from "@/components/providers/AuthProvider";
import AuthUnavailable from "@/components/auth/AuthUnavailable";
import { useUpdateOrderDraft } from "@/lib/hooks/useOrders";
import {
  useValidatePromoCode,
  useApplyPromoCode,
  useRemovePromoCode,
} from "@/lib/hooks/usePromoCode";
import { supabase } from "@/lib/supabase";
import type { Order, ShippingAddress } from "@/lib/types/store";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { shortDate } from "@/components/orders/orderFormat";


const REQUIRED_SHIPPING_FIELDS = ["name", "line1", "city", "country"] as const;
type RequiredShippingField = (typeof REQUIRED_SHIPPING_FIELDS)[number];
type ShippingValidationField = RequiredShippingField | "buyer_phone";

function normalizeShippingAddress(
  address?: Partial<ShippingAddress> | null
): ShippingAddress {
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

function hasRequiredShippingAddress(
  address?: Partial<ShippingAddress> | null
): boolean {
  const normalized = normalizeShippingAddress(address);
  return REQUIRED_SHIPPING_FIELDS.every(
    (field) => normalized[field].length > 0
  );
}

// ============================================================================
// ORDER LOADING
// ============================================================================

function useOrderData(orderId: string) {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("orders")
          .select(
            `
            *,
            product:products (id, title, slug, listing_type, delivery_type,
              media:product_media (media_url, is_primary),
              seller:profiles!products_seller_id_fkey (id, username, display_name, avatar_url),
              commission_listing:commission_listings (terms)
            ),
            pricing:product_pricing!orders_pricing_id_fkey (id, pricing_type, variant_name, price, currency, delivery_days, revisions)
          `
          )
          .eq("id", orderId)
          .single();

        if (err) throw err;

        const orderData = data as unknown as Order;
        if (user?.id && orderData.buyer_id !== user.id) {
          throw new Error("Not authorized to access this order");
        }

        setOrder(orderData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load order"
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId, user?.id]);

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
}: {
  orderId: string;
  orderAmount: number;
  listingType?: string;
  currency: string;
  onApplied: (discount: number, finalAmount: number, buyerFee: number | null) => void;
}) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    discount: number;
    originalAmount: number;
    finalAmount: number;
  } | null>(null);
  const {
    loading: validating,
    error: validateError,
    validate,
    clear,
  } = useValidatePromoCode();
  const { loading: applying, error: applyError, apply } = useApplyPromoCode();
  const {
    loading: removing,
    error: removeError,
    remove,
  } = useRemovePromoCode();

  const asAmount = useCallback(
    (value: unknown, fallback: number): number => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    []
  );

  const handleApply = useCallback(async () => {
    if (!code.trim()) return;

    const result = await validate(code, orderAmount, listingType);
    if (!result?.valid || !result.promo_code_id) return;

    const applyResult = await apply(orderId, result.promo_code_id);
    if (!applyResult?.success) return;

    const discount = asAmount(
      applyResult.discount_amount ?? result.discount_amount,
      0
    );
    const finalAmount = asAmount(
      applyResult.final_amount ?? result.final_amount,
      orderAmount
    );
    const originalAmount = asAmount(applyResult.original_amount, orderAmount);

    setApplied({
      code: code.trim().toUpperCase(),
      discount,
      originalAmount,
      finalAmount,
    });

    onApplied(
      discount,
      finalAmount,
      typeof applyResult.buyer_fee === "number" ? applyResult.buyer_fee : null
    );
  }, [
    apply,
    asAmount,
    code,
    listingType,
    onApplied,
    orderAmount,
    orderId,
    validate,
  ]);

  const isLoading = validating || applying || removing;
  const promoError = validateError || applyError || removeError;

  const [open, setOpen] = useState(false);

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-emerald-200 bg-emerald-50/60">
        <p className="text-sm font-ui text-ink min-w-0 truncate">
          <span className="font-semibold">{applied.code}</span> applied · −{formatCurrency(applied.discount, currency)}
        </p>
        <button
          type="button"
          onClick={async () => {
            const result = await remove(orderId);
            if (!result?.success) return;
            const finalAmount = asAmount(result.final_amount, orderAmount);
            setApplied(null);
            setCode("");
            clear();
            onApplied(0, finalAmount, typeof result.buyer_fee === "number" ? result.buyer_fee : null);
          }}
          disabled={removing}
          className="text-xs font-ui font-semibold text-muted hover:text-ink disabled:opacity-60 shrink-0"
        >
          {removing ? "Removing…" : "Remove"}
        </button>
        {removeError && <p className="text-xs text-red-600">{removeError}</p>}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-border-light bg-surface text-left hover:border-border-strong transition-colors">
        <span className="text-sm font-ui text-ink">Have a promo code?</span>
        <span className="text-xs font-ui font-semibold text-purple-primary">Add</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border-light bg-surface p-4 space-y-2">
      <label htmlFor="promo-code" className="block text-sm font-ui font-semibold text-ink">Promo code</label>
      <div className="flex gap-2">
        <input
          id="promo-code"
          type="text"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (promoError) clear();
          }}
          placeholder="Enter code"
          disabled={isLoading}
          autoFocus
          className="flex-1 px-3.5 py-2.5 rounded-xl border border-border-light bg-surface text-sm font-body text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-purple-primary/25 uppercase disabled:opacity-60"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleApply();
            }
          }}
        />
        <Button onClick={handleApply} disabled={isLoading || !code.trim()} loading={isLoading} loadingText="Applying…">Apply</Button>
      </div>
      {promoError && <p className="text-xs text-red-600">{promoError}</p>}
      <button type="button" onClick={() => { setOpen(false); setCode(""); clear(); }} className="text-xs font-ui text-muted hover:text-ink">Cancel</button>
    </div>
  );
}

// ============================================================================
// MAIN CHECKOUT PAGE
// ============================================================================

export default function CheckoutPage({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { user, loading: authLoading, status: authStatus, isAnonymous } = useAuth();
  const {
    order,
    loading: orderLoading,
    error: orderError,
    setOrder,
  } = useOrderData(orderId);
  const { updateDraft, updating: updatingDraft } = useUpdateOrderDraft();

  // Checkout session state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [chargeInfo, setChargeInfo] = useState<{ currency: string; amountCents: number; rate: number; converted: boolean } | null>(null);
  // One live Stripe session per (order, total): the effect below re-runs on
  // every order/promo change, so it must not mint a session when one already
  // exists for the same total or while a request is in flight.
  const checkoutInFlightRef = useRef(false);
  const lastCheckoutKeyRef = useRef<string | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<"stripe" | "placeholder">(
    "placeholder"
  );
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentUnlocked, setPaymentUnlocked] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  // UI state
  const [promoOverrides, setPromoOverrides] = useState<
    Record<string, { amount: number; discount: number; buyerFee: number | null }>
  >({});
  const [confirmingFree, setConfirmingFree] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shippingFieldErrors, setShippingFieldErrors] = useState<
    Partial<Record<ShippingValidationField, string>>
  >({});
  const [shippingSavedNotice, setShippingSavedNotice] = useState<
    string | null
  >(null);
  const [shippingDraftEdits, setShippingDraftEdits] = useState<
    Record<string, Partial<ShippingAddress>>
  >({});
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerNote, setBuyerNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const requiresSecurityCheck = Boolean(turnstileSiteKey);

  const resetPaymentGate = useCallback(() => {
    setClientSecret(null);
    setCheckoutMode("placeholder");
    setCheckoutError(null);
    setActionError(null);
    setPaymentUnlocked(false);
    setTurnstileToken(null);
    setTurnstileResetKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    resetPaymentGate();
  }, [orderId, resetPaymentGate]);

  const promoOverride = promoOverrides[orderId];
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

  const setShippingField = useCallback(
    (field: keyof ShippingAddress, value: string) => {
      setShippingDraftEdits((prev) => ({
        ...prev,
        [orderId]: { ...(prev[orderId] || {}), [field]: value },
      }));
    },
    [orderId]
  );

  const handleShippingFieldChange = useCallback(
    (field: keyof ShippingAddress, value: string) => {
      setShippingField(field, value);
      setShippingSavedNotice(null);
      if (shippingError) setShippingError(null);
      setShippingFieldErrors((prev) => {
        if (
          !REQUIRED_SHIPPING_FIELDS.includes(field as RequiredShippingField)
        )
          return prev;
        const requiredField = field as RequiredShippingField;
        if (!prev[requiredField]) return prev;
        const next = { ...prev };
        delete next[requiredField];
        return next;
      });
    },
    [setShippingField, shippingError]
  );

  const handlePhoneChange = useCallback(
    (value: string) => {
      setBuyerPhone(value);
      setShippingSavedNotice(null);
      if (shippingError) setShippingError(null);
      setShippingFieldErrors((prev) => {
        if (!prev.buyer_phone) return prev;
        const next = { ...prev };
        delete next.buyer_phone;
        return next;
      });
    },
    [shippingError]
  );

  // Initialize phone and note from order data
  useEffect(() => {
    if (!order) return;
    if (order.buyer_phone && !buyerPhone) setBuyerPhone(order.buyer_phone);
    if (order.buyer_note && !buyerNote) setBuyerNote(order.buyer_note);
    setNoteSaved(false);
    setNoteSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  // Create checkout session
  const createCheckout = useCallback(
    async (oid: string) => {
      if (requiresSecurityCheck && !turnstileToken) {
        setCheckoutError("Complete the security check before continuing to payment.");
        return;
      }

      if (checkoutInFlightRef.current) return;
      checkoutInFlightRef.current = true;
      setCheckoutLoading(true);
      setCheckoutError(null);
      setClientSecret(null);

      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: await buildAuthenticatedHeaders({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            order_id: oid,
            turnstile_token: requiresSecurityCheck ? turnstileToken : undefined,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to create checkout");
        }

        setCheckoutMode(data.mode || "placeholder");
        setClientSecret(data.client_secret || null);
        setChargeInfo(
          data.charge
            ? { currency: data.charge.currency, amountCents: data.charge.amount_cents, rate: data.charge.rate, converted: Boolean(data.charge.converted) }
            : null
        );
        setPaymentUnlocked(true);
      } catch (err) {
        setCheckoutError(
          err instanceof Error ? err.message : "Failed to create checkout"
        );
        if (requiresSecurityCheck) {
          setTurnstileToken(null);
          setTurnstileResetKey((prev) => prev + 1);
          setPaymentUnlocked(false);
        }
      } finally {
        checkoutInFlightRef.current = false;
        setCheckoutLoading(false);
      }
    },
    [requiresSecurityCheck, turnstileToken]
  );

  // Auto-create checkout when ready
  useEffect(() => {
    if (!order || order.status !== "pending_payment") return;
    if (requiresSecurityCheck) return;

    const isPhysical =
      order.listing_type === "product" &&
      order.product?.delivery_type !== "digital";
    const shippingReady =
      !isPhysical ||
      (hasRequiredShippingAddress(order.shipping_address) &&
        String(order.buyer_phone || "").trim().length > 0);

    if (!shippingReady) return;

    const override = promoOverrides[order.id];
    const key = `${order.id}:${override?.amount ?? order.amount}:${
      override?.buyerFee ?? order.buyer_fee ?? 0
    }`;
    if (checkoutInFlightRef.current) return;
    if (lastCheckoutKeyRef.current === key && clientSecret) return;
    lastCheckoutKeyRef.current = key;
    createCheckout(order.id);
  }, [order, promoOverrides, clientSecret, createCheckout, requiresSecurityCheck]);

  // Redirect only on a resolved signed-out state; a timed-out auth check
  // shows a retry panel below instead of bouncing the buyer mid-checkout.
  useEffect(() => {
    if (isAnonymous) router.replace("/login");
  }, [isAnonymous, router]);

  useEffect(() => {
    if (!order || !user || order.buyer_id !== user.id) return;
    if (order.status !== "pending_payment") {
      router.replace(`/orders/${orderId}`);
    }
  }, [order, orderId, router, user]);

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
      setShippingError(
        "Complete all required shipping fields to continue."
      );
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

    setOrder((prev) =>
      prev
        ? { ...prev, shipping_address: payload, buyer_phone: trimmedPhone }
        : prev
    );
    resetPaymentGate();
    setShippingDraftEdits((prev) => {
      if (!(orderId in prev)) return prev;
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
    setShippingSavedNotice("Shipping details saved.");
  }, [
    order,
    orderId,
    resetPaymentGate,
    setOrder,
    shippingDraft,
    updateDraft,
    buyerPhone,
  ]);

  // Confirm free/placeholder order
  const handleConfirmFree = useCallback(async () => {
    if (!order) return;
    setConfirmingFree(true);
    setActionError(null);

    try {
      const res = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: await buildAuthenticatedHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ order_id: order.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Confirmation failed");
      }

      router.push(`/orders/${orderId}?payment=success`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Confirmation failed"
      );
    } finally {
      setConfirmingFree(false);
    }
  }, [order, orderId, router]);

  const handleUnlockPayment = useCallback(() => {
    if (!order) return;

    if (!turnstileToken) {
      setCheckoutError("Complete the security check before continuing to payment.");
      return;
    }

    void createCheckout(order.id);
  }, [createCheckout, order, turnstileToken]);

  // Loading state
  if (authLoading || orderLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-[var(--color-purple-primary)]" />
      </div>
    );
  }

  if (authStatus === "unknown") return <AuthUnavailable />;

  if (!user) return null;

  if (orderError || !order) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h2 className="mb-2 text-xl font-display text-ink">
          Order Not Found
        </h2>
        <p className="text-sm font-body text-muted">
          {orderError || "This order does not exist."}
        </p>
      </div>
    );
  }

  if (order.buyer_id !== user.id) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h2 className="mb-2 text-xl font-display text-ink">
          Not Authorized
        </h2>
        <p className="text-sm font-body text-muted">
          You do not have access to this order.
        </p>
      </div>
    );
  }

  if (order.status !== "pending_payment") return null;

  // Derived state
  const amount = Math.max(
    promoOverride?.amount ?? Number(order.amount),
    0
  );
  const shippingCost = Number(order.shipping_cost || 0);
  const originalAmount = Number(
    order.original_amount ??
      Number(order.amount) + Number(order.discount_amount || 0)
  );
  const effectiveDiscount = Math.max(
    promoOverride?.discount ?? Number(order.discount_amount || 0),
    0
  );
  const subtotal = Math.max(originalAmount - shippingCost, 0);
  // Buyer-side processing fee (D3): charged on top of `amount`.
  const buyerFee = Math.max(
    promoOverride?.buyerFee ?? Number(order.buyer_fee || 0),
    0
  );
  const totalDue = amount + buyerFee;
  const zeroTotal = totalDue <= 0;
  const isPhysicalProduct =
    order.listing_type === "product" &&
    order.product?.delivery_type !== "digital";
  const shippingAddressComplete = hasRequiredShippingAddress(
    order.shipping_address
  );
  const shippingPhoneComplete =
    String(order.buyer_phone || "").trim().length > 0;
  const requiresShippingDetails =
    isPhysicalProduct &&
    (!shippingAddressComplete || !shippingPhoneComplete);
  const shippingReady =
    !isPhysicalProduct || (shippingAddressComplete && shippingPhoneComplete);
  const noteHasChanges =
    buyerNote.trim() !== String(order.buyer_note || "").trim();
  const shippingHasChanges = isPhysicalProduct
    ? JSON.stringify(normalizeShippingAddress(shippingDraft)) !==
        JSON.stringify(normalizeShippingAddress(order.shipping_address)) ||
      buyerPhone.trim() !== String(order.buyer_phone || "").trim()
    : false;
  const productImage =
    order.product?.media?.find(
      (item: { is_primary: boolean }) => item.is_primary
    )?.media_url || order.product?.media?.[0]?.media_url;
  const currency = order.currency || "USD";

  const isCommission = order.listing_type === "service";
  const sellerName = order.product?.seller?.display_name || order.product?.seller?.username || "the creator";
  const firstName = sellerName.split(" ")[0];
  const pricing = order.pricing;
  const terms = typeof order.product?.commission_listing?.terms === "string" && order.product.commission_listing.terms.trim() ? order.product.commission_listing.terms : null;
  const orderMeta = isCommission
    ? [pricing?.variant_name ? `${pricing.variant_name} package` : "Commission", pricing?.delivery_days ? `${pricing.delivery_days}-day delivery` : null, pricing?.revisions != null ? `${pricing.revisions} revision${pricing.revisions === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")
    : isPhysicalProduct ? `Physical product${order.quantity > 1 ? ` × ${order.quantity}` : ""} · ships to you` : `Digital product${order.quantity > 1 ? ` × ${order.quantity}` : ""} · files ready after payment`;
  const showPayArea = !requiresShippingDetails;
  const inputClass = "w-full px-3.5 py-2.5 rounded-xl border bg-surface text-sm font-body text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-purple-primary/25 transition-shadow";

  const moneyCard = (
    <section className="rounded-2xl border border-border-light bg-surface p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-ui font-semibold text-ink">Summary</p>
        <span className="text-2xs font-ui text-muted tabular-nums">{order.order_number}</span>
      </div>
      <div className="space-y-2 text-sm font-body">
        <div className="flex justify-between gap-4"><span className="text-muted">{isCommission ? (pricing?.variant_name ? `${pricing.variant_name} package` : "Commission") : order.quantity > 1 ? `Product × ${order.quantity}` : "Product"}</span><span className="text-ink tabular-nums">{formatCurrency(subtotal, currency)}</span></div>
        {shippingCost > 0 && <div className="flex justify-between gap-4"><span className="text-muted">Shipping</span><span className="text-ink tabular-nums">{formatCurrency(shippingCost, currency)}</span></div>}
        {effectiveDiscount > 0 && <div className="flex justify-between gap-4"><span className="text-muted">Discount</span><span className="text-ink tabular-nums">−{formatCurrency(effectiveDiscount, currency)}</span></div>}
        {buyerFee > 0 && <div className="flex justify-between gap-4 text-muted/80"><span>Processing fee</span><span className="tabular-nums">{formatCurrency(buyerFee, currency)}</span></div>}
        <div className="flex justify-between gap-4 pt-2 border-t border-border-light font-ui font-semibold text-ink"><span>Total</span><span className="tabular-nums text-base">{formatCurrency(totalDue, currency)}</span></div>
        {chargeInfo?.converted && !zeroTotal && (
          <p className="text-2xs font-body text-muted">Charged as {formatCurrency(chargeInfo.amountCents / 100, chargeInfo.currency)} at 1 {currency.toUpperCase()} = {chargeInfo.rate.toFixed(4)} {chargeInfo.currency.toUpperCase()}.</p>
        )}
        {isCommission ? (
          <p className="text-2xs font-body text-muted">Held by Pinkquill until you approve the work. {firstName} is paid 7 days after approval.</p>
        ) : !isPhysicalProduct ? (
          <p className="text-2xs font-body text-muted">Your files unlock the moment payment lands.</p>
        ) : null}
      </div>
    </section>
  );

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-4 sm:pt-6">
        <nav className="flex items-center gap-1.5 text-xs font-ui text-muted" aria-label="Breadcrumb">
          <Link href="/orders" className="hover:text-accent transition-colors">Orders</Link>
          <span aria-hidden="true">›</span>
          <Link href={`/orders/${order.id}`} className="hover:text-accent transition-colors tabular-nums">{order.order_number}</Link>
          <span aria-hidden="true">›</span>
          <span className="text-ink font-medium">Checkout</span>
        </nav>
        <h1 className="font-display text-xl sm:text-2xl font-semibold text-ink mt-3">Checkout</h1>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
          <div className="space-y-3">
            {/* What you're paying for */}
            <section className="rounded-2xl border border-border-light bg-surface p-4 flex gap-4">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 shrink-0">
                {productImage && <Image src={productImage as string} alt="" fill className="object-cover" sizes="80px" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-ui font-semibold text-ink truncate">{order.product?.title || "Order"}</p>
                <p className="text-xs font-body text-muted mt-0.5">{orderMeta}</p>
                <p className="text-xs font-body text-muted mt-0.5">by {sellerName}</p>
                {isCommission && order.due_date && (
                  <p className="text-xs font-ui text-ink mt-2">Due <span className="font-semibold">{shortDate(order.due_date)}</span> · the clock starts when you pay</p>
                )}
              </div>
            </section>

            {/* Promo */}
            <PromoCodeSection
              orderId={order.id}
              orderAmount={originalAmount}
              listingType={order.listing_type}
              currency={currency}
              onApplied={(discount, final, buyerFeeValue) => {
                setPromoOverrides((prev) => ({
                  ...prev,
                  [order.id]: { amount: final, discount, buyerFee: buyerFeeValue },
                }));
                setActionError(null);
                // Pricing changes invalidate the existing checkout session.
                if (!requiresShippingDetails) {
                  if (requiresSecurityCheck) {
                    resetPaymentGate();
                  } else {
                    setClientSecret(null);
                    createCheckout(order.id);
                  }
                }
              }}
            />

            {/* Note to the seller */}
            {!noteOpen && !order.buyer_note ? (
              <button type="button" onClick={() => setNoteOpen(true)} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-border-light bg-surface text-left hover:border-border-strong transition-colors">
                <span className="text-sm font-ui text-ink">Add a note for {firstName}</span>
                <span className="text-xs font-ui font-semibold text-purple-primary">Add</span>
              </button>
            ) : (
              <section className="rounded-2xl border border-border-light bg-surface p-4">
                <label htmlFor="buyer-note" className="block text-sm font-ui font-semibold text-ink mb-1.5">Note for {firstName} <span className="font-normal text-muted text-xs">optional</span></label>
                <textarea
                  id="buyer-note"
                  value={buyerNote}
                  onChange={(event) => {
                    const val = event.target.value;
                    setBuyerNote(val);
                    setNoteSaved(false);
                    setNoteSaveError(null);
                    setNoteError(val.length > 500 ? "Keep the note under 500 characters." : null);
                  }}
                  placeholder="Anything they should know before starting."
                  maxLength={500}
                  rows={3}
                  aria-invalid={!!noteError}
                  className={`${inputClass} ${noteError ? "border-red-300" : "border-border-light"}`}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className={`text-xs font-body ${buyerNote.length > 500 ? "text-red-600" : "text-muted"}`}>
                    {noteSaved ? "Saved" : noteHasChanges ? "Unsaved" : ""}{noteSaved || noteHasChanges ? " · " : ""}{buyerNote.length}/500
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={updatingDraft || buyerNote.length > 500 || !noteHasChanges}
                    loading={updatingDraft}
                    loadingText="Saving…"
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
                  >
                    Save note
                  </Button>
                </div>
                {noteError && <p className="text-xs text-red-600 mt-1">{noteError}</p>}
                {noteSaveError && <p className="text-xs text-red-600 mt-1">{noteSaveError}</p>}
              </section>
            )}

            {/* Shipping (physical products only) */}
            {isPhysicalProduct && (
              <section className="rounded-2xl border border-border-light bg-surface p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-ui font-semibold text-ink">Ships to</p>
                  <span className={`text-2xs font-ui font-semibold rounded-full border px-2 py-0.5 ${shippingReady ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    {shippingReady ? "Saved" : "Needed before payment"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { id: "name", label: "Full name", autoComplete: "name", required: true, wide: false },
                    { id: "line1", label: "Address", autoComplete: "address-line1", required: true, wide: true },
                    { id: "line2", label: "Apartment, suite", autoComplete: "address-line2", required: false, wide: true },
                    { id: "city", label: "City", autoComplete: "address-level2", required: true, wide: false },
                    { id: "state", label: "State / region", autoComplete: "address-level1", required: false, wide: false },
                    { id: "postal_code", label: "Postal code", autoComplete: "postal-code", required: false, wide: false },
                    { id: "country", label: "Country", autoComplete: "country-name", required: true, wide: false },
                  ] as const).map((field) => {
                    const fieldError = field.required ? (shippingFieldErrors as Record<string, string>)[field.id] : undefined;
                    return (
                      <div key={field.id} className={field.wide ? "sm:col-span-2" : ""}>
                        <label htmlFor={`shipping-${field.id}`} className="block text-xs font-ui font-semibold text-ink mb-1">
                          {field.label}{field.required && <span className="text-pink-vivid"> *</span>}
                        </label>
                        <input
                          id={`shipping-${field.id}`}
                          type="text"
                          autoComplete={field.autoComplete}
                          value={(shippingDraft as Record<string, string>)[field.id] || ""}
                          onChange={(event) => handleShippingFieldChange(field.id as keyof ShippingAddress, event.target.value)}
                          aria-invalid={field.required ? !!fieldError : undefined}
                          className={`${inputClass} ${fieldError ? "border-red-300" : "border-border-light"}`}
                        />
                        {fieldError && <p className="text-xs text-red-600 mt-1">{fieldError}</p>}
                      </div>
                    );
                  })}
                  <div>
                    <label htmlFor="shipping-phone" className="block text-xs font-ui font-semibold text-ink mb-1">Phone<span className="text-pink-vivid"> *</span></label>
                    <input
                      id="shipping-phone"
                      type="tel"
                      autoComplete="tel"
                      value={buyerPhone}
                      onChange={(event) => handlePhoneChange(event.target.value)}
                      aria-invalid={!!shippingFieldErrors.buyer_phone}
                      className={`${inputClass} ${shippingFieldErrors.buyer_phone ? "border-red-300" : "border-border-light"}`}
                    />
                    {shippingFieldErrors.buyer_phone && <p className="text-xs text-red-600 mt-1">{shippingFieldErrors.buyer_phone}</p>}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button onClick={handleSaveShippingDetails} disabled={updatingDraft || !shippingHasChanges} loading={updatingDraft} loadingText="Saving…">
                    {order.shipping_address ? "Update shipping details" : "Save shipping details"}
                  </Button>
                  {shippingSavedNotice && <span className="text-xs font-body text-emerald-700">{shippingSavedNotice}</span>}
                  {shippingError && <span className="text-xs font-body text-red-600">{shippingError}</span>}
                </div>
              </section>
            )}

            {/* Money card on phones sits above the payment form */}
            <div className="lg:hidden">{moneyCard}</div>

            {/* Payment */}
            {!showPayArea ? (
              <section className="rounded-2xl border border-border-light bg-subtle p-4">
                <p className="text-sm font-ui font-semibold text-ink">Payment</p>
                <p className="text-xs font-body text-muted mt-1">Save your shipping details to continue. The card form appears here.</p>
              </section>
            ) : (
              <section className="rounded-2xl border border-border-light bg-surface p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-ui font-semibold text-ink">{zeroTotal ? "Nothing to pay" : `Pay ${formatCurrency(totalDue, currency)}`}</p>
                  {!zeroTotal && <span className="text-2xs font-ui text-muted">Secure · Stripe</span>}
                </div>

                {requiresSecurityCheck && !paymentUnlocked && !checkoutLoading && (
                  <div className="space-y-3 rounded-xl border border-border-light bg-subtle p-4">
                    <p className="text-sm font-body text-muted">A quick security check unlocks the card form.</p>
                    <TurnstileCaptcha
                      siteKey={turnstileSiteKey!}
                      action="checkout_create"
                      resetKey={turnstileResetKey}
                      onTokenChange={setTurnstileToken}
                    />
                    <Button onClick={handleUnlockPayment} disabled={!turnstileToken}>Continue to payment</Button>
                  </div>
                )}

                {checkoutLoading && (
                  <div className="flex items-center justify-center rounded-xl border border-border-light bg-subtle py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-[var(--color-purple-primary)]" />
                  </div>
                )}

                {checkoutError && (
                  <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                    <p className="text-sm font-body text-red-700">{checkoutError}</p>
                    <button
                      type="button"
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
                {actionError && <p className="text-sm text-red-600">{actionError}</p>}

                {(!requiresSecurityCheck || paymentUnlocked) && checkoutMode === "stripe" && clientSecret && !checkoutLoading && !checkoutError && !zeroTotal && (
                  <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                )}

                {(!requiresSecurityCheck || paymentUnlocked) && (checkoutMode === "placeholder" || zeroTotal) && !checkoutLoading && !checkoutError && (
                  <div className="space-y-3">
                    {zeroTotal ? (
                      <p className="text-sm font-body text-muted">{effectiveDiscount > 0 ? "Your promo covered the total. Confirm to start the order." : "No payment is needed for this order. Confirm to start it."}</p>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs font-body text-amber-800">Payments are running in test mode. No real charge is made.</div>
                    )}
                    <Button fullWidth onClick={handleConfirmFree} disabled={confirmingFree} loading={confirmingFree} loadingText="Confirming…">
                      {zeroTotal ? "Confirm order" : "Confirm payment"}
                    </Button>
                  </div>
                )}

                {isCommission && terms && !zeroTotal && (
                  <details className="mt-3 text-2xs font-body text-muted">
                    <summary className="cursor-pointer">By paying you agree to {firstName}&apos;s terms. <span className="text-purple-primary font-ui">Read terms</span></summary>
                    <p className="mt-2 whitespace-pre-line max-h-40 overflow-y-auto text-ink/80">{terms}</p>
                  </details>
                )}
              </section>
            )}
          </div>

          <aside className="hidden lg:block"><div className="sticky top-6">{moneyCard}</div></aside>
        </div>
      </div>
    </div>
  );
}
