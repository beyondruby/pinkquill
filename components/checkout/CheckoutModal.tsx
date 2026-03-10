"use client";

import { useCallback, useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe-client";
import {
  buildStripeBillingDefaults,
  buildStripeElementsOptions,
  buildStripePaymentElementOptions,
  type StripeBillingDefaults,
} from "@/lib/stripe-checkout-ui";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCheckout } from "@/lib/hooks/usePayments";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/lib/types/store";
import TurnstileCaptcha from "@/components/security/TurnstileCaptcha";

interface CheckoutModalProps {
  order: Order;
  onSuccess: () => void;
  onClose: () => void;
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
// ORDER SUMMARY (shared across all modes)
// ============================================================================

function OrderSummary({ order }: { order: Order }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
      <h3 className="font-semibold text-sm text-gray-700">Order Summary</h3>
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">
          {order.product?.title || "Order"}
        </span>
        <span className="font-medium">
          ${Number(order.amount).toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Platform fee</span>
        <span>${Number(order.platform_fee).toFixed(2)}</span>
      </div>
      <div className="border-t pt-2 flex justify-between font-semibold">
        <span>Total</span>
        <span>${Number(order.amount).toFixed(2)}</span>
      </div>
      {order.listing_type === "service" && (
        <p className="text-xs text-gray-500 mt-1">
          Your payment is held securely until you approve the delivery.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// STRIPE CHECKOUT FORM
// ============================================================================

interface StripeCheckoutFormProps extends CheckoutModalProps {
  captchaToken: string | null;
  onCaptchaConsumed: () => void;
  billingDefaults?: StripeBillingDefaults;
}

function StripeCheckoutForm({
  order,
  onSuccess,
  onClose,
  captchaToken,
  onCaptchaConsumed,
  billingDefaults,
}: StripeCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    try {
      if (!captchaToken) {
        setError("Complete the security check before payment.");
        setProcessing(false);
        return;
      }

      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Complete your payment details before continuing.");
        setProcessing(false);
        return;
      }

      const { error: stripeError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders/${order.id}?payment=success`,
        },
        redirect: "if_required",
      });

      if (stripeError) {
        setError(stripeError.message || "Payment failed");
        setProcessing(false);
        return;
      }

      const confirmResponse = await (async () => {
        try {
          return await fetch("/api/payments/confirm", {
            method: "POST",
            headers: await buildAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ order_id: order.id, captcha_token: captchaToken }),
          });
        } finally {
          onCaptchaConsumed();
        }
      })();
      if (!confirmResponse.ok) {
        const confirmData = await confirmResponse.json().catch(() => ({}));
        setError(confirmData.error || "Payment confirmation failed");
        setProcessing(false);
        return;
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setProcessing(false);
    }
  }, [stripe, elements, order.id, onCaptchaConsumed, captchaToken, onSuccess]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <OrderSummary order={order} />
      <PaymentElement options={buildStripePaymentElementOptions(billingDefaults)} />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={processing}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || processing || !captchaToken}
          className="flex-1 px-4 py-2.5 bg-[var(--color-purple-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {processing ? "Processing..." : `Pay $${Number(order.amount).toFixed(2)}`}
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// MAIN CHECKOUT MODAL
// ============================================================================

export default function CheckoutModal({ order, onSuccess, onClose }: CheckoutModalProps) {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const { user, profile } = useAuth();
  const {
    mode,
    clientSecret,
    loading,
    error: checkoutError,
    createCheckout,
    confirmPayment,
  } = useCheckout();
  const [stripeReady, setStripeReady] = useState(false);
  const [confirmingPlaceholder, setConfirmingPlaceholder] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaTokenOrderId, setCaptchaTokenOrderId] = useState(order.id);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  useEffect(() => {
    createCheckout(order.id);
  }, [order.id, createCheckout]);

  useEffect(() => {
    if (mode !== "stripe") return;
    getStripe().then((s) => {
      if (s) setStripeReady(true);
    });
  }, [mode]);

  const handleCaptchaTokenChange = useCallback((token: string | null) => {
    setCaptchaToken(token);
    setCaptchaTokenOrderId(order.id);
  }, [order.id]);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaTokenOrderId(order.id);
    setCaptchaResetKey((prev) => prev + 1);
  }, [order.id]);

  const billingDefaults = buildStripeBillingDefaults({
    name: profile?.display_name ?? undefined,
    email: user?.email ?? undefined,
    phone: order.buyer_phone ?? undefined,
  });

  const elementsOptions = clientSecret
    ? buildStripeElementsOptions(clientSecret)
    : undefined;

  const zeroTotal = Number(order.amount) <= 0;
  const captchaEnabled = Boolean(turnstileSiteKey);
  const activeCaptchaToken = captchaTokenOrderId === order.id ? captchaToken : null;
  const captchaReady = captchaEnabled ? Boolean(activeCaptchaToken) : process.env.NODE_ENV !== "production";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Complete Payment</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close checkout"
          >
            &times;
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[var(--color-purple-primary)]" />
          </div>
        )}

        {checkoutError && (
          <div className="text-center py-8">
            <p className="text-red-600 text-sm mb-4">{checkoutError}</p>
            <button
              onClick={() => createCheckout(order.id)}
              className="text-sm text-[var(--color-purple-primary)] hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* PLACEHOLDER MODE */}
        {mode === "placeholder" && !checkoutError && !loading && (
          <div className="space-y-6">
            <div className="rounded-xl border border-black/[0.06] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-gray-500">Security Check</p>
              <p className="mt-1 text-xs text-gray-500">
                Complete this step to protect checkout from automated payment abuse.
              </p>
              {captchaEnabled ? (
                <TurnstileCaptcha
                  siteKey={turnstileSiteKey}
                  action="payments_confirm"
                  resetKey={`${order.id}:${captchaResetKey}`}
                  onTokenChange={handleCaptchaTokenChange}
                  className="mt-3"
                />
              ) : (
                <p className="mt-3 text-xs text-red-600">
                  Security check is not configured. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {zeroTotal ? (
                <>
                  <p className="font-semibold">No payment due for this order.</p>
                  <p className="mt-1">Your current total is $0.00. Complete the order to continue.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Payment provider fallback is active.</p>
                  <p className="mt-1">
                    We could not initialize card/wallet checkout for this order. Confirm payment with fallback to continue.
                  </p>
                </>
              )}
            </div>
            <div className="rounded-xl border border-black/[0.06] p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Order total</span>
                <span className="font-semibold">${Number(order.amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Provider</span>
                <span className="font-semibold">Placeholder</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={confirmingPlaceholder}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!captchaReady) return;
                  setConfirmingPlaceholder(true);
                  const success = await confirmPayment(order.id, activeCaptchaToken);
                  resetCaptcha();
                  setConfirmingPlaceholder(false);
                  if (success) onSuccess();
                }}
                disabled={confirmingPlaceholder || !captchaReady}
                className="flex-1 px-4 py-2.5 bg-[var(--color-purple-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {confirmingPlaceholder ? "Confirming..." : zeroTotal ? "Complete Order" : "Confirm Payment"}
              </button>
            </div>
          </div>
        )}

        {/* STRIPE MODE */}
        {mode === "stripe" && clientSecret && stripeReady && elementsOptions && (
          <div className="space-y-4">
            <div className="rounded-xl border border-black/[0.06] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-gray-500">Security Check</p>
              <p className="mt-1 text-xs text-gray-500">
                Complete this step to protect checkout from automated payment abuse.
              </p>
              {captchaEnabled ? (
                <TurnstileCaptcha
                  siteKey={turnstileSiteKey}
                  action="payments_confirm"
                  resetKey={`${order.id}:${captchaResetKey}`}
                  onTokenChange={handleCaptchaTokenChange}
                  className="mt-3"
                />
              ) : (
                <p className="mt-3 text-xs text-red-600">
                  Security check is not configured. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
                </p>
              )}
            </div>
            <Elements stripe={getStripe()} options={elementsOptions}>
              <StripeCheckoutForm
                order={order}
                onSuccess={onSuccess}
                onClose={onClose}
                captchaToken={activeCaptchaToken}
                onCaptchaConsumed={resetCaptcha}
                billingDefaults={billingDefaults}
              />
            </Elements>
          </div>
        )}

      </div>
    </div>
  );
}
