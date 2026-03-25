"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerProducts, useUpdateProductStatus, useDeleteProduct } from "@/lib/hooks";
import type { Product, ProductStatus } from "@/lib/types/store";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active: { label: "Active", dot: "bg-green-500", bg: "bg-green-50", text: "text-green-700" },
  paused: { label: "Paused", dot: "bg-yellow-400", bg: "bg-yellow-50", text: "text-yellow-700" },
  draft: { label: "Draft", dot: "bg-gray-400", bg: "bg-gray-50", text: "text-gray-600" },
  sold: { label: "Sold", dot: "bg-blue-400", bg: "bg-blue-50", text: "text-blue-700" },
  archived: { label: "Archived", dot: "bg-red-400", bg: "bg-red-50", text: "text-red-600" },
};

// ---------------------------------------------------------------------------
// Listing Card
// ---------------------------------------------------------------------------

function ListingCard({
  product,
  onStatusChange,
  onDelete,
}: {
  product: Product;
  onStatusChange: (id: string, status: ProductStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const router = useRouter();
  const [showActions, setShowActions] = useState(false);
  const [busy, setBusy] = useState(false);

  const primaryImage = product.primary_image_url || product.media?.[0]?.media_url;
  const isService = product.listing_type === "service";
  const statusConfig = STATUS_CONFIG[product.status || "draft"] || STATUS_CONFIG.draft;

  const handleStatusChange = useCallback(async (status: ProductStatus) => {
    setBusy(true);
    await onStatusChange(product.id, status);
    setBusy(false);
    setShowActions(false);
  }, [product.id, onStatusChange]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    setBusy(true);
    await onDelete(product.id);
    setBusy(false);
  }, [product.id, onDelete]);

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white overflow-hidden group hover:shadow-sm hover:border-black/[0.1] transition-all">
      {/* Image */}
      <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
        {primaryImage ? (
          <Image src={primaryImage} alt="" fill className="object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        {/* Status Badge */}
        <span className={`absolute top-2.5 left-2.5 inline-flex items-center gap-1 text-[10px] font-ui font-medium px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text} backdrop-blur-sm`}>
          <span className={`w-1 h-1 rounded-full ${statusConfig.dot}`} />
          {statusConfig.label}
        </span>

        {/* Type Badge */}
        <span className="absolute top-2.5 right-2.5 text-[10px] font-ui font-medium px-2 py-0.5 rounded-full bg-white/90 text-ink backdrop-blur-sm border border-black/[0.04]">
          {isService ? "Commission" : "Product"}
        </span>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="font-ui text-sm font-semibold text-ink truncate">{product.title}</h3>
        <div className="flex items-center justify-between mt-1.5">
          <span className="font-display text-sm font-bold text-purple-primary">
            {product.min_price != null
              ? product.min_price === product.max_price
                ? `$${product.min_price.toFixed(2)}`
                : `$${product.min_price.toFixed(2)} – $${product.max_price?.toFixed(2)}`
              : "No price"}
          </span>
          {product.category && (
            <span className="text-[10px] font-ui text-muted bg-gray-50 px-1.5 py-0.5 rounded">
              {product.category}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2 relative">
          <Link
            href={isService ? `/commissions/${product.id}` : `/product/${product.id}`}
            className="flex-1 text-center py-1.5 text-xs font-ui font-medium text-muted border border-black/[0.06] rounded-lg hover:bg-gray-50 transition-colors"
          >
            View
          </Link>
          <button
            onClick={() => {
              setShowActions(false);
              router.push(`/sell/edit/${product.id}`);
            }}
            className="flex-1 text-center py-1.5 text-xs font-ui font-medium text-ink border border-black/[0.06] rounded-lg hover:bg-gray-50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setShowActions(!showActions)}
            disabled={busy}
            className="px-2.5 py-1.5 text-xs font-ui text-muted border border-black/[0.06] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {busy ? (
              <div className="w-3 h-3 border border-gray-300 border-t-purple-primary rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
              </svg>
            )}
          </button>

          {/* Actions dropdown */}
          {showActions && (
            <>
              <div className="fixed inset-0 z-[5]" onClick={() => setShowActions(false)} />
              <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-black/[0.08] rounded-lg shadow-lg py-1 min-w-[140px]">
                {product.status === "active" && (
                  <button
                    onClick={() => handleStatusChange("paused")}
                    className="block w-full text-left px-3.5 py-2 text-sm font-ui text-ink hover:bg-gray-50"
                  >
                    Pause Listing
                  </button>
                )}
                {product.status === "paused" && (
                  <button
                    onClick={() => handleStatusChange("active")}
                    className="block w-full text-left px-3.5 py-2 text-sm font-ui text-ink hover:bg-gray-50"
                  >
                    Activate
                  </button>
                )}
                {product.status === "draft" && (
                  <button
                    onClick={() => handleStatusChange("active")}
                    className="block w-full text-left px-3.5 py-2 text-sm font-ui text-ink hover:bg-gray-50"
                  >
                    Publish
                  </button>
                )}
                {product.status !== "archived" && (
                  <button
                    onClick={() => handleStatusChange("archived")}
                    className="block w-full text-left px-3.5 py-2 text-sm font-ui text-ink hover:bg-gray-50"
                  >
                    Archive
                  </button>
                )}
                {product.status === "archived" && (
                  <button
                    onClick={() => handleStatusChange("active")}
                    className="block w-full text-left px-3.5 py-2 text-sm font-ui text-ink hover:bg-gray-50"
                  >
                    Restore
                  </button>
                )}
                <hr className="my-1 border-black/[0.04]" />
                <button
                  onClick={handleDelete}
                  className="block w-full text-left px-3.5 py-2 text-sm font-ui text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SellerListingsGrid() {
  const { user } = useAuth();
  const { products, loading, refetch } = useSellerProducts(user?.id);
  const { updateStatus } = useUpdateProductStatus();
  const { deleteProduct } = useDeleteProduct();
  const [filter, setFilter] = useState<"all" | "product" | "service">("all");

  const filtered = filter === "all"
    ? products
    : products.filter((p) => p.listing_type === filter);

  const handleStatusChange = useCallback(async (productId: string, status: ProductStatus) => {
    await updateStatus(productId, status);
    await refetch();
  }, [updateStatus, refetch]);

  const handleDelete = useCallback(async (productId: string) => {
    await deleteProduct(productId);
    await refetch();
  }, [deleteProduct, refetch]);

  const counts = {
    all: products.length,
    product: products.filter((p) => p.listing_type === "product").length,
    service: products.filter((p) => p.listing_type === "service").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Listings</h1>
          <p className="text-sm font-body text-muted mt-0.5">{products.length} listing{products.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/sell"
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-primary text-white rounded-lg text-sm font-ui font-semibold hover:bg-purple-primary/90 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Product
          </Link>
          <Link
            href="/sell/service"
            className="inline-flex items-center gap-2 px-4 py-2 border border-black/[0.08] bg-white rounded-lg text-sm font-ui font-medium text-ink hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Commission
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="border-b border-black/[0.06]">
        <div className="flex gap-0 -mb-px">
          {(["all", "product", "service"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-3 text-sm font-ui font-medium border-b-2 transition-colors ${
                filter === f
                  ? "border-purple-primary text-purple-primary"
                  : "border-transparent text-muted hover:text-ink hover:border-gray-200"
              }`}
            >
              {f === "all" ? "All" : f === "product" ? "Products" : "Commissions"}
              <span className="ml-1.5 text-xs opacity-60">({counts[f]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl bg-gray-50 animate-pulse border border-black/[0.04] aspect-[3/4]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <p className="font-body text-sm text-muted">
            {filter === "all"
              ? "No listings yet. Create your first product or commission!"
              : `No ${filter === "product" ? "products" : "commissions"} yet.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product) => (
            <ListingCard
              key={product.id}
              product={product}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
