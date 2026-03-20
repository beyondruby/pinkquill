"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faTimesCircle,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

type CheckoutStatus = "loading" | "success" | "failed" | "expired";

async function buildAuthHeaders(): Promise<Headers> {
  const headers = new Headers();
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  } catch {
    // Auth not ready yet — will retry
  }
  return headers;
}

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2000;

export default function CheckoutCompletePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<CheckoutStatus>("loading");
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
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
        { headers: await buildAuthHeaders() }
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
        setOrderStatus(data.order_status);
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

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <FontAwesomeIcon
              icon={faSpinner}
              className="text-4xl text-purple-500 animate-spin"
            />
            <h2 className="text-xl font-semibold text-ink">
              Confirming your payment...
            </h2>
            <p className="text-muted">
              Please wait while we verify your payment.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <FontAwesomeIcon
              icon={faCheckCircle}
              className="text-5xl text-green-500"
            />
            <h2 className="text-2xl font-semibold text-ink">
              Payment Successful!
            </h2>
            <p className="text-muted">
              Your order has been confirmed. {orderStatus === "delivered"
                ? "Your digital content is ready for download."
                : "The seller has been notified."}
            </p>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => router.push(`/orders/${orderId}`)}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                View Order
              </button>
              <button
                onClick={() => router.push("/")}
                className="px-6 py-3 text-purple-600 hover:text-purple-700 transition-colors font-medium"
              >
                Back to Feed
              </button>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="space-y-4">
            <FontAwesomeIcon
              icon={faTimesCircle}
              className="text-5xl text-red-500"
            />
            <h2 className="text-2xl font-semibold text-ink">
              Payment Failed
            </h2>
            <p className="text-muted">
              Something went wrong with your payment. No charges were made.
            </p>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => router.push(`/checkout/${orderId}`)}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push("/")}
                className="px-6 py-3 text-purple-600 hover:text-purple-700 transition-colors font-medium"
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
            <h2 className="text-2xl font-semibold text-ink">
              Checkout Expired
            </h2>
            <p className="text-muted">
              Your checkout session has expired. Please start a new checkout.
            </p>
            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={() => router.push(`/checkout/${orderId}`)}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
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
