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

type CheckoutStatus = "loading" | "success" | "failed" | "expired";

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2000;
const AUTO_REDIRECT_DELAY_MS = 2000;

export default function CheckoutCompletePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<CheckoutStatus>("loading");
  const [redirectCountdown, setRedirectCountdown] = useState(2);
  const pollCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkStatus = useCallback(async (): Promise<boolean> => {
    if (!sessionId) {
      setStatus("failed");
      return true; // stop polling
    }

    try {
      const res = await fetch(
        `/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`,
        { headers: await buildAuthenticatedHeaders() }
      );

      if (!res.ok) {
        // Auth might not be ready yet — retry
        if (res.status === 401 && pollCountRef.current < MAX_POLLS) {
          return false; // keep polling
        }
        setStatus("failed");
        return true;
      }

      const data = await res.json();

      if (data.status === "complete" || data.payment_status === "paid") {
        setStatus("success");
        return true;
      } else if (data.status === "expired") {
        setStatus("expired");
        return true;
      } else {
        // Session still open — payment may be processing
        return false; // keep polling
      }
    } catch {
      // Network error — retry
      return false;
    }
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;

      const done = await checkStatus();

      if (!done && !cancelled) {
        pollCountRef.current += 1;
        if (pollCountRef.current >= MAX_POLLS) {
          // Give up after max polls — show failed
          setStatus("failed");
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
              Confirming your payment...
            </h2>
            <p className="font-body text-muted">
              Please wait while we verify your payment.
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
              Payment Successful!
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
              Payment Failed
            </h2>
            <p className="font-body text-muted">
              Something went wrong with your payment. No charges were made.
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
