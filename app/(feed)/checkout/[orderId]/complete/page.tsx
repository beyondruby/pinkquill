"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { buildAuthenticatedHeaders } from "@/lib/auth-client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import { Spinner } from "@/components/ui/Loading";

type CheckoutStatus = "loading" | "success" | "failed" | "expired" | "processing";

const MAX_POLLS = 15;
const POLL_INTERVAL_MS = 2000;
const AUTO_REDIRECT_DELAY_MS = 2000;

export default function CheckoutCompletePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<CheckoutStatus>("loading");
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState(2);
  const pollCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The database (written by the Stripe webhook) is the only source of truth
  // here. Stripe's own session status is never used to declare success.
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

  // Auto-redirect to order page on success
  useEffect(() => {
    if (status !== "success") return;

    const countdownTimer = setInterval(() => {
      setRedirectCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);

    const redirectTimer = setTimeout(() => {
      router.push(`/orders/${orderId}`);
    }, AUTO_REDIRECT_DELAY_MS);

    return () => {
      clearInterval(countdownTimer);
      clearTimeout(redirectTimer);
    };
  }, [status, orderId, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <Spinner size="xl" className="text-purple-500 mx-auto" />
            <h2 className="text-xl font-display font-semibold text-ink">
              Payment received, confirming…
            </h2>
            <p className="font-body text-muted">
              We&apos;re waiting for Stripe to confirm. This usually takes a few seconds.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50">
              <FontAwesomeIcon
                icon={faCheckCircle}
                className="text-4xl text-green-500"
              />
            </div>
            <h2 className="text-2xl font-display font-semibold text-ink">
              Payment confirmed
            </h2>
            <p className="font-body text-muted">
              Redirecting to your order{redirectCountdown > 0 ? ` in ${redirectCountdown}s` : ""}...
            </p>
            <div className="w-full bg-skeleton rounded-full h-1 mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full transition-all duration-[2000ms] ease-linear"
                style={{ width: status === "success" ? "100%" : "0%" }}
              />
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="space-y-4">
            <FontAwesomeIcon
              icon={faTimesCircle}
              className="text-5xl text-red-500"
            />
            <h2 className="text-2xl font-display font-semibold text-ink">
              Payment declined
            </h2>
            <p className="font-body text-muted">
              {failureMessage || "Your card was declined."} Nothing was charged. You can try again with another card.
            </p>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => router.push(`/checkout/${orderId}`)}
                className="px-6 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl font-ui font-semibold hover:opacity-90 transition-opacity"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push("/")}
                className="px-6 py-3 font-ui text-purple-primary hover:text-pink-vivid transition-colors font-medium"
              >
                Back to Feed
              </button>
            </div>
          </div>
        )}

        {status === "processing" && (
          <div className="space-y-4">
            <Spinner size="xl" className="text-purple-500 mx-auto" />
            <h2 className="text-2xl font-display font-semibold text-ink">
              Still processing
            </h2>
            <p className="font-body text-muted">
              Your payment is taking longer than usual to confirm. Your order page will update as soon as it lands, and you&apos;ll get a notification.
            </p>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => router.push(`/orders/${orderId}`)}
                className="px-6 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl font-ui font-semibold hover:opacity-90 transition-opacity"
              >
                Go to your order
              </button>
            </div>
          </div>
        )}

        {status === "expired" && (
          <div className="space-y-4">
            <FontAwesomeIcon
              icon={faTimesCircle}
              className="text-5xl text-amber-500"
            />
            <h2 className="text-2xl font-display font-semibold text-ink">
              Checkout Expired
            </h2>
            <p className="font-body text-muted">
              Your checkout session has expired. Please start a new checkout.
            </p>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => router.push(`/checkout/${orderId}`)}
                className="px-6 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl font-ui font-semibold hover:opacity-90 transition-opacity"
              >
                Start New Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
