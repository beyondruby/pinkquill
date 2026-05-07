"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBox, faTruck, faCheckCircle, faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import type { Order } from "@/lib/types/store";

const CARRIER_URLS: Record<string, string> = {
  usps: "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
  ups: "https://www.ups.com/track?tracknum=",
  fedex: "https://www.fedex.com/fedextrack/?trknbr=",
  dhl: "https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=",
};

function getTrackingUrl(carrier: string | null, number: string): string | null {
  if (!carrier) return null;
  const base = CARRIER_URLS[carrier.toLowerCase()];
  return base ? base + encodeURIComponent(number) : null;
}

export default function ShippingTracker({ order }: { order: Order }) {
  const hasTracking = !!order.tracking_number;
  const isShipped = ["shipped", "delivered", "completed"].includes(order.status);
  const isDelivered = ["delivered", "completed"].includes(order.status);

  if (!isShipped && !hasTracking) return null;

  const trackingUrl = getTrackingUrl(order.tracking_carrier, order.tracking_number || "");

  return (
    <section className="rounded-2xl border border-border-light bg-surface p-5">
      <h3 className="font-display text-lg text-ink mb-4">Shipping Status</h3>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center gap-1">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
            <FontAwesomeIcon icon={faBox} className="text-white text-xs" />
          </div>
          <span className="text-xs font-ui text-emerald-700 ml-1">Packed</span>
        </div>
        <div className={`flex-1 h-1 rounded ${isShipped ? "bg-emerald-400" : "bg-skeleton"}`} />
        <div className="flex items-center gap-1">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isShipped ? "bg-emerald-500" : "bg-skeleton"
          }`}>
            <FontAwesomeIcon icon={faTruck} className={isShipped ? "text-white text-xs" : "text-muted/60 text-xs"} />
          </div>
          <span className={`text-xs font-ui ml-1 ${isShipped ? "text-emerald-700" : "text-muted"}`}>
            Shipped
          </span>
        </div>
        <div className={`flex-1 h-1 rounded ${isDelivered ? "bg-emerald-400" : "bg-skeleton"}`} />
        <div className="flex items-center gap-1">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isDelivered ? "bg-emerald-500" : "bg-skeleton"
          }`}>
            <FontAwesomeIcon icon={faCheckCircle} className={isDelivered ? "text-white text-xs" : "text-muted/60 text-xs"} />
          </div>
          <span className={`text-xs font-ui ml-1 ${isDelivered ? "text-emerald-700" : "text-muted"}`}>
            Delivered
          </span>
        </div>
      </div>

      {/* Tracking details */}
      {hasTracking && (
        <div className="rounded-xl bg-subtle border border-border-light p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-ui text-muted uppercase tracking-wider mb-1">
                Tracking Number
              </p>
              <p className="font-ui font-medium text-ink text-sm">
                {order.tracking_number}
              </p>
              {order.tracking_carrier && (
                <p className="text-xs font-body text-muted mt-0.5 capitalize">
                  {order.tracking_carrier}
                </p>
              )}
            </div>
            {trackingUrl && (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg text-xs font-ui font-semibold text-purple-primary border border-purple-200 hover:bg-purple-50 transition-colors"
              >
                Track <FontAwesomeIcon icon={faExternalLinkAlt} className="ml-1 text-[10px]" />
              </a>
            )}
          </div>
          {order.shipped_at && (
            <p className="text-xs font-body text-muted mt-2">
              Shipped on {new Date(order.shipped_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
          {order.delivered_at && (
            <p className="text-xs font-body text-emerald-600 mt-1">
              Delivered on {new Date(order.delivered_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
