"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { getStripe } from "@/lib/stripe-client";
import { getPayPalClientId } from "@/lib/paypal-client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCheckout, type CheckoutMode } from "@/lib/hooks/usePayments";
import { useValidatePromoCode, useApplyPromoCode, useRemovePromoCode } from "@/lib/hooks/usePromoCode";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/lib/types/store";

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
  onApplied,
  onCheckoutRefresh,
}: {
  orderId: string;
  orderAmount: number;
  listingType?: string;
  onApplied: (discount: number, finalAmount: number) => void;
  onCheckoutRefresh?: () => Promise<unknown> | unknown;
}) {
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
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
    if (applyResult?.success) {
      const discount = asAmount(applyResult.discount_amount ?? result.discount_amount, 0);
      const final = asAmount(applyResult.final_amount ?? result.final_amount, orderAmount);
      setApplied({ code: code.trim().toUpperCase(), discount });
      onApplied(discount, final);
      await onCheckoutRefresh?.();
    }
  }, [apply, asAmount, code, listingType, onApplied, onCheckoutRefresh, orderAmount, orderId, validate]);

  const isLoading = validating || applying || removing;
  const promoError = validateError || applyError || removeError;

  if (applied) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              {applied.code}
            </span>
            <span className="text-sm text-green-700">-${applied.discount.toFixed(2)}</span>
          </div>
          <button
            onClick={async () => {
              const result = await remove(orderId);
              if (!result?.success) return;
              setApplied(null);
              setCode("");
              clear();
              onApplied(0, asAmount(result.final_amount, orderAmount));
              await onCheckoutRefresh?.();
            }}
            disabled={removing}
            className="text-xs text-green-600 hover:underline disabled:opacity-60"
          >
            {removing ? "Removing..." : "Remove"}
          </button>
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
          onChange={(e) => { setCode(e.target.value); if (promoError) clear(); }}
          placeholder="Promo code"
          disabled={isLoading}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--color-purple-primary)] outline-none disabled:opacity-50"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApply(); } }}
        />
        <button
          onClick={handleApply}
          disabled={isLoading || !code.trim()}
          className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          {isLoading ? "..." : "Apply"}
        </button>
      </div>
      {promoError && <p className="text-xs text-red-600">{promoError}</p>}
    </div>
  );
}

// ============================================================================
// STRIPE INLINE FORM
// ============================================================================

function StripeInlineForm({ orderId, onSuccess }: { orderId: string; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        headers: { "Content-Type": "application/json" },
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full px-6 py-3 bg-[var(--color-purple-primary)] text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {processing ? "Processing..." : "Pay Now"}
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
        createOrder={async () => {
          return paypalOrderId;
        }}
        onApprove={async () => {
          setProcessing(true);
          setError(null);
          try {
            const res = await fetch("/api/payments/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
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
        <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-[var(--color-purple-primary)]" />
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
  const { order, loading: orderLoading, error: orderError } = useOrderData(orderId);
  const { mode, clientSecret, paypalOrderId, loading: checkoutLoading, error: checkoutError, createCheckout } = useCheckout();
  const [stripeReady, setStripeReady] = useState(false);
  const [displayAmount, setDisplayAmount] = useState<number | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Start checkout session
  useEffect(() => {
    if (order && order.status === "pending_payment") {
      createCheckout(order.id);
    }
  }, [order, createCheckout]);

  // Load stripe when needed
  useEffect(() => {
    if (mode !== "stripe") return;
    getStripe().then((s) => { if (s) setStripeReady(true); });
  }, [mode]);

  // Set display amount from order
  useEffect(() => {
    if (order) setDisplayAmount(Number(order.amount));
  }, [order]);

  const handleSuccess = useCallback(() => {
    router.push(`/orders/${orderId}?payment=success`);
  }, [router, orderId]);

  const handlePlaceholderConfirm = useCallback(async () => {
    const res = await fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });
    if (res.ok) handleSuccess();
  }, [orderId, handleSuccess]);

  if (authLoading || orderLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[var(--color-purple-primary)]" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (orderError || !order) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h2 className="text-xl font-bold mb-2">Order Not Found</h2>
        <p className="text-gray-600 text-sm">{orderError || "This order does not exist."}</p>
      </div>
    );
  }

  if (order.buyer_id !== user.id) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h2 className="text-xl font-bold mb-2">Not Authorized</h2>
        <p className="text-gray-600 text-sm">You do not have access to this order.</p>
      </div>
    );
  }

  if (order.status !== "pending_payment") {
    router.push(`/orders/${orderId}`);
    return null;
  }

  const amount = displayAmount ?? Number(order.amount);
  const productImage = order.product?.media?.find((m: { is_primary: boolean })=> m.is_primary)?.media_url
    || order.product?.media?.[0]?.media_url;
  const paypalClientId = getPayPalClientId();

  const elementsOptions: StripeElementsOptions | undefined = clientSecret
    ? {
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: "#8e44ad", borderRadius: "8px" } },
      }
    : undefined;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Payment */}
        <div className="lg:col-span-3 space-y-6">
          {/* Promo Code */}
          <div className="bg-white rounded-2xl border border-black/[0.06] p-5">
            <h3 className="font-semibold text-sm text-gray-700 mb-3">Promo Code</h3>
            <PromoCodeSection
              orderId={order.id}
              orderAmount={Number(order.original_amount || order.amount)}
              listingType={order.listing_type}
              onApplied={(discount, final) => {
                setDiscountAmount(discount);
                setDisplayAmount(final);
              }}
              onCheckoutRefresh={() => createCheckout(order.id)}
            />
          </div>

          {/* Payment Method */}
          <div className="bg-white rounded-2xl border border-black/[0.06] p-5">
            <h3 className="font-semibold text-sm text-gray-700 mb-4">Payment Method</h3>

            {checkoutLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-[var(--color-purple-primary)]" />
              </div>
            )}

            {checkoutError && (
              <div className="text-center py-4">
                <p className="text-red-600 text-sm mb-2">{checkoutError}</p>
                <button onClick={() => createCheckout(order.id)} className="text-sm text-[var(--color-purple-primary)] hover:underline">
                  Try again
                </button>
              </div>
            )}

            {/* Stripe */}
            {mode === "stripe" && clientSecret && stripeReady && elementsOptions && (
              <Elements stripe={getStripe()} options={elementsOptions}>
                <StripeInlineForm orderId={order.id} onSuccess={handleSuccess} />
              </Elements>
            )}

            {/* PayPal */}
            {mode === "paypal" && paypalOrderId && paypalClientId && !checkoutLoading && !checkoutError && (
              <PayPalScriptProvider
                options={{
                  clientId: paypalClientId,
                  currency: (order.currency || "USD").toUpperCase(),
                  intent: order.listing_type === "service" ? "authorize" : "capture",
                }}
              >
                <PayPalInlineButtons
                  orderId={order.id}
                  paypalOrderId={paypalOrderId}
                  onSuccess={handleSuccess}
                />
              </PayPalScriptProvider>
            )}

            {/* Placeholder */}
            {mode === "placeholder" && !checkoutLoading && !checkoutError && (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Test Mode</p>
                  <p className="mt-0.5 text-xs">No real payment will be charged.</p>
                </div>
                <button
                  onClick={handlePlaceholderConfirm}
                  className="w-full px-6 py-3 bg-[var(--color-purple-primary)] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
                >
                  Confirm Payment
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-black/[0.06] p-5 sticky top-8">
            <h3 className="font-semibold text-gray-700 mb-4">Order Summary</h3>

            {/* Product */}
            <div className="flex gap-3 mb-4">
              {productImage && (
                <img
                  src={productImage as string}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{order.product?.title || "Order"}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {order.listing_type === "service" ? "Commission" : "Product"}
                </p>
                {order.product?.seller && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    by @{(order.product.seller as { username: string }).username}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>${Number(order.original_amount || order.amount).toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-400">
                <span>Platform fee</span>
                <span>${Number(order.platform_fee).toFixed(2)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>${amount.toFixed(2)}</span>
              </div>
            </div>

            {order.listing_type === "service" && (
              <p className="text-xs text-gray-500 mt-3 bg-gray-50 rounded-lg p-2.5">
                Payment is held in escrow and released after you approve the delivery.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
