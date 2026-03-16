"use client";

import { useEffect, useState, useCallback } from "react";
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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return headers;
}

export default function CheckoutCompletePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<CheckoutStatus>("loading");
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!sessionId) {
      setStatus("failed");
      return;
    }

    try {
      const res = await fetch(
        `/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`,
        { headers: await buildAuthHeaders() }
      );
      const data = await res.json();

      if (!res.ok) {
        setStatus("failed");
        return;
      }

      if (data.status === "complete" || data.payment_status === "paid") {
        setStatus("success");
        setOrderStatus(data.order_status);
      } else if (data.status === "expired") {
        setStatus("expired");
      } else {
        // Session still open — payment not complete yet
        setStatus("failed");
      }
    } catch {
      setStatus("failed");
    }
  }, [sessionId]);

  useEffect(() => {
    checkStatus();
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
