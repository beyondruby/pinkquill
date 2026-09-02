"use client";

import { formatCurrency } from "@/lib/utils/currency";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCreateOrder } from "@/lib/hooks/useOrders";
import { useStudioCart, type StudioQueueItem } from "@/lib/hooks/useStudioQueue";

type ServiceFields = {
  brief: string;
  notes: string;
  timelineDays: number;
};

function createDefaultServiceFields(): ServiceFields {
  return { brief: "", notes: "", timelineDays: 7 };
}

const formatPrice = (amount: number, currency: string) => formatCurrency(amount, currency);

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */
function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center mb-6">
        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-purple-primary/60">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      </div>
      <h2 className="font-display text-xl text-ink mb-1">Your bag is empty</h2>
      <p className="text-sm font-body text-muted max-w-xs mb-6">
        Browse products and commissions to add items here.
      </p>
      <Link
        href="/shop"
        className="inline-flex px-6 py-2.5 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid hover:opacity-90 transition-opacity"
      >
        Browse Marketplace
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Cart Item Card                                                     */
/* ------------------------------------------------------------------ */
function CartItemCard({
  item,
  serviceFields,
  onUpdateField,
  onRemove,
  onStartOrder,
  isSubmitting,
  isCreating,
}: {
  item: StudioQueueItem;
  serviceFields: ServiceFields;
  onUpdateField: (field: keyof ServiceFields, value: string | number) => void;
  onRemove: () => void;
  onStartOrder: () => void;
  isSubmitting: boolean;
  isCreating: boolean;
}) {
  const isService = item.listing_type === "service";

  return (
    <div className="group rounded-2xl border border-border-light bg-surface hover:border-border-light transition-colors">
      {/* Item header */}
      <div className="flex items-start gap-4 p-4 sm:p-5">
        {/* Thumbnail */}
        <Link href={isService ? `/commissions/${item.product_id}` : `/product/${item.product_id}`} className="shrink-0">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt=""
              width={80}
              height={80}
              className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl object-cover"
            />
          ) : (
            <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-purple-primary/40">
                {isService ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                )}
              </svg>
            </div>
          )}
        </Link>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-ui font-semibold uppercase tracking-wider mb-1 ${
                  isService
                    ? "bg-purple-primary/8 text-purple-primary"
                    : "bg-emerald-500/8 text-emerald-600"
                }`}
              >
                {isService ? "Commission" : "Product"}
              </span>
              <h3 className="font-ui font-semibold text-ink text-sm sm:text-base truncate">
                <Link href={isService ? `/commissions/${item.product_id}` : `/product/${item.product_id}`} className="hover:underline">
                  {item.title}
                </Link>
              </h3>
              <p className="text-xs font-body text-muted mt-0.5">by {item.seller_name}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-ui font-semibold text-ink text-sm sm:text-base">
                {formatPrice(
                  typeof item.chosen_amount === "number" ? item.chosen_amount : item.price,
                  item.currency
                )}
              </p>
              {typeof item.chosen_amount === "number" && item.chosen_amount !== item.price && (
                <p className="text-[10px] font-body text-muted mt-0.5">Pay what you want</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Service brief form */}
      {isService && (
        <div className="px-4 sm:px-5 pb-1 space-y-3">
          <div className="h-px bg-skeleton/70" />
          <label className="block">
            <span className="text-xs font-ui font-medium text-ink/70 mb-1 block">
              Project Brief <span className="text-red-400">*</span>
            </span>
            <textarea
              rows={3}
              value={serviceFields.brief}
              onChange={(e) => onUpdateField("brief", e.target.value)}
              placeholder="Describe your vision — goals, references, must-have deliverables..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-border-light text-sm font-body placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-200 resize-none"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-ui font-medium text-ink/70 mb-1 block">Timeline (days)</span>
              <input
                type="number"
                min={1}
                value={serviceFields.timelineDays}
                onChange={(e) => onUpdateField("timelineDays", Math.max(1, Number(e.target.value || 1)))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-light text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-200"
              />
            </label>
            <label className="block">
              <span className="text-xs font-ui font-medium text-ink/70 mb-1 block">Extra Notes</span>
              <input
                value={serviceFields.notes}
                onChange={(e) => onUpdateField("notes", e.target.value)}
                placeholder="Optional"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-light text-sm font-body placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-200"
              />
            </label>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 mt-1 border-t border-border-light">
        <button
          onClick={onRemove}
          className="text-xs font-ui text-muted hover:text-red-500 transition-colors"
        >
          Remove
        </button>
        <button
          onClick={onStartOrder}
          disabled={isCreating || isSubmitting}
          className="px-4 py-2 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {isSubmitting ? "Processing..." : isService ? "Start Order" : "Checkout"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Order Summary Sidebar                                              */
/* ------------------------------------------------------------------ */
function OrderSummary({ items }: { items: StudioQueueItem[] }) {
  const effectivePrice = (item: StudioQueueItem) =>
    typeof item.chosen_amount === "number" ? item.chosen_amount : item.price;
  const subtotal = items.reduce((sum, item) => sum + effectivePrice(item), 0);
  const currency = items[0]?.currency || "usd";
  const serviceCount = items.filter((i) => i.listing_type === "service").length;
  const productCount = items.length - serviceCount;

  return (
    <div className="rounded-2xl border border-border-light bg-surface p-5 sticky top-24">
      <h2 className="font-ui font-semibold text-ink text-base mb-4">Summary</h2>

      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.id} className="flex justify-between items-start gap-3 text-sm">
            <span className="font-body text-ink/80 truncate">{item.title}</span>
            <span className="font-ui font-medium text-ink shrink-0">{formatPrice(effectivePrice(item), item.currency)}</span>
          </div>
        ))}
      </div>

      <div className="h-px bg-skeleton my-4" />

      <div className="flex justify-between font-ui text-base font-semibold text-ink">
        <span>Subtotal</span>
        <span>{formatPrice(subtotal, currency)}</span>
      </div>
      <p className="text-[11px] font-body text-muted mt-1.5">
        Platform fees calculated at checkout
      </p>

      <div className="mt-4 pt-3 border-t border-border-light">
        <div className="flex flex-wrap gap-2 text-[11px] font-ui text-muted">
          {productCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/8 text-emerald-600">
              {productCount} {productCount === 1 ? "product" : "products"}
            </span>
          )}
          {serviceCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-purple-primary/8 text-purple-primary">
              {serviceCount} {serviceCount === 1 ? "commission" : "commissions"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function StudioCartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { createOrder, creating, error } = useCreateOrder();
  const { items, hydrated, removeItem, clearCart } = useStudioCart();

  const [serviceDrafts, setServiceDrafts] = useState<Record<string, ServiceFields>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null);

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
          brief: fields.brief.trim(),
          due_date: dueDate.toISOString(),
          requirements: { notes: fields.notes || "" },
        });

        if (order) {
          removeItem(item.id);
          router.push(`/orders/${order.id}`);
        }
        return;
      }

      const order = await createOrder({
        product_id: item.product_id,
        pricing_id: item.pricing_id,
        chosen_amount: typeof item.chosen_amount === "number" ? item.chosen_amount : null,
      });

      if (order) {
        removeItem(item.id);
        router.push(`/checkout/${order.id}`);
      }
    } finally {
      setSubmittingItemId(null);
    }
  };

  /* Loading skeleton */
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="h-6 w-32 rounded-lg bg-skeleton animate-pulse mb-6" />
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-36 rounded-2xl bg-skeleton animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasItems = items.length > 0;

  return (
    <div className="min-h-screen bg-background py-6 sm:py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl text-ink">Bag</h1>
            {hasItems && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-ui font-semibold bg-skeleton text-ink/60">
                {items.length}
              </span>
            )}
          </div>
          {hasItems && (
            <button
              onClick={clearCart}
              className="text-xs font-ui text-muted hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Error banner */}
        {(actionError || error) && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm font-body text-red-600">
            {actionError || error}
          </div>
        )}

        {!hasItems ? (
          <EmptyCart />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Items list */}
            <div className="flex-1 space-y-4 min-w-0">
              {items.map((item) => (
                <CartItemCard
                  key={item.id}
                  item={item}
                  serviceFields={serviceDrafts[item.id] || createDefaultServiceFields()}
                  onUpdateField={(field, value) => updateServiceField(item.id, field, value)}
                  onRemove={() => removeItem(item.id)}
                  onStartOrder={() => startOrder(item)}
                  isSubmitting={submittingItemId === item.id}
                  isCreating={creating}
                />
              ))}

              {/* Continue shopping link */}
              <div className="pt-2">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-1.5 text-sm font-ui text-muted hover:text-accent transition-colors"
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Continue shopping
                </Link>
              </div>
            </div>

            {/* Summary sidebar */}
            <div className="w-full lg:w-72 shrink-0">
              <OrderSummary items={items} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
