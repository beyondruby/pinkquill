"use client";

import { useCallback, useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { getStripe } from "@/lib/stripe-client";
import { useCheckout } from "@/lib/hooks/usePayments";
import type { Order } from "@/lib/types/store";

interface CheckoutModalProps {
  order: Order;
  onSuccess: () => void;
  onClose: () => void;
}

function CheckoutForm({ order, onSuccess, onClose }: CheckoutModalProps) {
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

      const confirmResponse = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id }),
      });
      if (!confirmResponse.ok) {
        const confirmData = await confirmResponse.json().catch(() => ({}));
        setError(confirmData.error || "Payment confirmation failed");
        setProcessing(false);
        return;
      }

      // Payment succeeded and backend state was finalized
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setProcessing(false);
    }
  }, [stripe, elements, order.id, onSuccess]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Summary */}
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

      {/* Stripe Payment Element */}
      <PaymentElement />

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

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
          disabled={!stripe || processing}
          className="flex-1 px-4 py-2.5 bg-[var(--color-purple-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {processing ? "Processing..." : `Pay $${Number(order.amount).toFixed(2)}`}
        </button>
      </div>
    </form>
  );
}

export default function CheckoutModal({ order, onSuccess, onClose }: CheckoutModalProps) {
  const {
    mode,
    clientSecret,
    loading,
    error: checkoutError,
    createCheckout,
    confirmPlaceholderPayment,
  } = useCheckout();
  const [stripeReady, setStripeReady] = useState(false);
  const [confirmingPlaceholder, setConfirmingPlaceholder] = useState(false);

  useEffect(() => {
    createCheckout(order.id);
  }, [order.id, createCheckout]);

  useEffect(() => {
    if (mode !== "stripe") return;
    getStripe().then((s) => {
      if (s) setStripeReady(true);
    });
  }, [mode]);

  const elementsOptions: StripeElementsOptions | undefined = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#8e44ad",
            borderRadius: "8px",
          },
        },
      }
    : undefined;

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

        {mode === "placeholder" && !checkoutError && !loading && (
          <div className="space-y-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Placeholder payment mode is active.</p>
              <p className="mt-1">
                Stripe setup is pending. Confirm payment with the temporary flow so order work can continue.
              </p>
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
                  setConfirmingPlaceholder(true);
                  const success = await confirmPlaceholderPayment(order.id);
                  setConfirmingPlaceholder(false);
                  if (success) onSuccess();
                }}
                disabled={confirmingPlaceholder}
                className="flex-1 px-4 py-2.5 bg-[var(--color-purple-primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {confirmingPlaceholder ? "Confirming..." : "Confirm Placeholder Payment"}
              </button>
            </div>
          </div>
        )}

        {mode === "stripe" && clientSecret && stripeReady && elementsOptions && (
          <Elements stripe={getStripe()} options={elementsOptions}>
            <CheckoutForm order={order} onSuccess={onSuccess} onClose={onClose} />
          </Elements>
        )}
      </div>
    </div>
  );
}
