"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCreateOrder } from "@/lib/hooks/useOrders";
import { useStudioQueue, type StudioQueueItem } from "@/lib/hooks/useStudioQueue";
import type { ShippingAddress } from "@/lib/types/store";

type ServiceFields = {
  brief: string;
  notes: string;
  timelineDays: number;
};

function createDefaultServiceFields(): ServiceFields {
  return { brief: "", notes: "", timelineDays: 7 };
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function StudioQueuePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { createOrder, creating, error } = useCreateOrder();
  const { items, hydrated, removeItem, clearQueue } = useStudioQueue();

  const [serviceDrafts, setServiceDrafts] = useState<Record<string, ServiceFields>>({});
  const [physicalShipping, setPhysicalShipping] = useState<Partial<ShippingAddress>>({
    name: "",
    line1: "",
    city: "",
    postal_code: "",
    country: "",
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null);

  const hasPhysicalItems = useMemo(
    () => items.some((item) => item.listing_type === "product" && item.delivery_type !== "digital"),
    [items]
  );

  const updateServiceField = (itemId: string, field: keyof ServiceFields, value: string | number) => {
    setServiceDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || createDefaultServiceFields()),
        [field]: value,
      },
    }));
  };

  const startOrder = async (item: StudioQueueItem) => {
    if (!user) {
      router.push("/login");
      return;
    }

    setActionError(null);
    setSubmittingItemId(item.id);

    try {
      if (item.listing_type === "service") {
        const fields = serviceDrafts[item.id] || createDefaultServiceFields();
        if (!fields.brief.trim()) {
          setActionError("Add a project brief before starting this commission order.");
          return;
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + Math.max(1, fields.timelineDays));

        const order = await createOrder({
          product_id: item.product_id,
          pricing_id: item.pricing_id,
          listing_type: "service",
          amount: item.price,
          platform_fee: 0,
          seller_amount: 0,
          currency: item.currency,
          brief: fields.brief.trim(),
          due_date: dueDate.toISOString(),
          requirements: { notes: fields.notes || "" },
        });

        if (order) {
          removeItem(item.id);
          router.push(`/orders/${order.id}?payment=start`);
        }
        return;
      }

      const needsShipping = item.delivery_type !== "digital";
      if (needsShipping && (!physicalShipping.name || !physicalShipping.line1 || !physicalShipping.city || !physicalShipping.country)) {
        setActionError("Fill in the shipping address before starting physical product orders.");
        return;
      }

      const order = await createOrder({
        product_id: item.product_id,
        pricing_id: item.pricing_id,
        listing_type: "product",
        amount: item.price,
        platform_fee: 0,
        seller_amount: 0,
        currency: item.currency,
        shipping_address: needsShipping ? (physicalShipping as ShippingAddress) : undefined,
      });

      if (order) {
        removeItem(item.id);
        router.push(`/orders/${order.id}?payment=start`);
      }
    } finally {
      setSubmittingItemId(null);
    }
  };

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-5xl mx-auto space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
          <p className="text-xs font-ui uppercase tracking-wider text-purple-primary mb-2">Creative Checkout</p>
          <h1 className="font-display text-3xl text-ink">Studio Queue</h1>
          <p className="text-sm font-body text-muted mt-2">
            Collect commissions and products here, then launch each order with your brief and delivery details.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="px-4 py-2 rounded-xl border border-black/[0.08] text-sm font-ui text-ink hover:bg-black/[0.02]"
            >
              Browse Marketplace
            </Link>
            {items.length > 0 && (
              <button
                onClick={clearQueue}
                className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-sm font-ui text-red-600 hover:bg-red-100"
              >
                Clear Queue
              </button>
            )}
          </div>
        </section>

        {hasPhysicalItems && (
          <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
            <h2 className="font-display text-xl text-ink mb-3">Shipping Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                placeholder="Full name"
                value={physicalShipping.name || ""}
                onChange={(e) => setPhysicalShipping((prev) => ({ ...prev, name: e.target.value }))}
                className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
              />
              <input
                placeholder="Address line 1"
                value={physicalShipping.line1 || ""}
                onChange={(e) => setPhysicalShipping((prev) => ({ ...prev, line1: e.target.value }))}
                className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
              />
              <input
                placeholder="City"
                value={physicalShipping.city || ""}
                onChange={(e) => setPhysicalShipping((prev) => ({ ...prev, city: e.target.value }))}
                className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
              />
              <input
                placeholder="Postal code"
                value={physicalShipping.postal_code || ""}
                onChange={(e) => setPhysicalShipping((prev) => ({ ...prev, postal_code: e.target.value }))}
                className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
              />
              <input
                placeholder="Country"
                value={physicalShipping.country || ""}
                onChange={(e) => setPhysicalShipping((prev) => ({ ...prev, country: e.target.value }))}
                className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body sm:col-span-2"
              />
            </div>
          </section>
        )}

        {items.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-black/[0.12] bg-white p-10 text-center">
            <h2 className="font-display text-2xl text-ink mb-2">Your Studio Queue is empty</h2>
            <p className="text-sm font-body text-muted mb-6">
              Add creations from product or commission pages to start a guided order flow.
            </p>
            <Link
              href="/shop"
              className="inline-flex px-6 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid"
            >
              Explore Marketplace
            </Link>
          </section>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const serviceFields = serviceDrafts[item.id] || createDefaultServiceFields();
              const isService = item.listing_type === "service";

              return (
                <section key={item.id} className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt=""
                        width={96}
                        height={96}
                        className="w-20 h-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-ui uppercase tracking-wider text-muted">
                        {isService ? "Commission Service" : "Product Listing"}
                      </p>
                      <h3 className="font-ui font-semibold text-ink truncate">{item.title}</h3>
                      <p className="text-xs font-body text-muted mt-0.5">
                        by {item.seller_name} &middot; {formatPrice(item.price, item.currency)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-sm font-ui text-red-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>

                  {isService && (
                    <div className="space-y-3">
                      <textarea
                        rows={4}
                        value={serviceFields.brief}
                        onChange={(e) => updateServiceField(item.id, "brief", e.target.value)}
                        placeholder="Project brief (required): goals, references, must-have deliverables..."
                        className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="number"
                          min={1}
                          value={serviceFields.timelineDays}
                          onChange={(e) => updateServiceField(item.id, "timelineDays", Math.max(1, Number(e.target.value || 1)))}
                          className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                        />
                        <input
                          value={serviceFields.notes}
                          onChange={(e) => updateServiceField(item.id, "notes", e.target.value)}
                          placeholder="Extra notes (optional)"
                          className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => startOrder(item)}
                      disabled={creating || submittingItemId === item.id}
                      className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
                    >
                      {submittingItemId === item.id ? "Starting..." : "Start Order"}
                    </button>
                    <Link
                      href={isService ? `/commissions/${item.product_id}` : `/product/${item.product_id}`}
                      className="px-5 py-3 rounded-xl text-sm font-ui text-ink border border-black/[0.08] hover:bg-black/[0.02]"
                    >
                      View Listing
                    </Link>
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {(actionError || error) && (
          <p className="text-sm font-body text-red-500">{actionError || error}</p>
        )}
      </div>
    </div>
  );
}
