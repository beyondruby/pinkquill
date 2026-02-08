"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerProducts, useUpdateProductStatus, useDeleteProduct } from "@/lib/hooks";
import type { Product, ProductStatus } from "@/lib/types/store";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  draft: "bg-gray-100 text-gray-600",
  sold: "bg-blue-100 text-blue-700",
  archived: "bg-red-100 text-red-600",
};

function ListingCard({
  product,
  onStatusChange,
  onDelete,
}: {
  product: Product;
  onStatusChange: (id: string, status: ProductStatus) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [showActions, setShowActions] = useState(false);
  const [busy, setBusy] = useState(false);

  const primaryImage = product.primary_image_url || product.media?.[0]?.media_url;
  const isService = product.listing_type === "service";

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
    <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden group relative">
      {/* Image */}
      <div className="aspect-[4/3] bg-gray-100 relative">
        {primaryImage ? (
          <Image src={primaryImage} alt="" fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">
            No image
          </div>
        )}

        {/* Status Badge */}
        <span className={`absolute top-3 left-3 text-[10px] font-ui font-medium px-2.5 py-1 rounded-full ${
          STATUS_COLORS[product.status || "draft"] || STATUS_COLORS.draft
        }`}>
          {product.status || "draft"}
        </span>

        {/* Type Badge */}
        <span className="absolute top-3 right-3 text-[10px] font-ui font-medium px-2.5 py-1 rounded-full bg-white/90 text-ink">
          {isService ? "Commission" : "Product"}
        </span>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-ui text-sm font-semibold text-ink truncate">{product.title}</h3>
        <div className="flex items-center justify-between mt-2">
          <span className="font-ui text-sm text-purple-primary font-semibold">
            {product.min_price != null
              ? product.min_price === product.max_price
                ? `$${product.min_price.toFixed(2)}`
                : `$${product.min_price.toFixed(2)} – $${product.max_price?.toFixed(2)}`
              : "No price"}
          </span>
          <span className="text-xs text-muted">
            {product.category}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2 relative">
          <Link
            href={isService ? `/product/${product.id}` : `/product/${product.id}`}
            className="flex-1 text-center py-1.5 text-xs font-ui font-medium text-muted border border-black/[0.08] rounded-lg hover:bg-black/[0.02] transition-colors"
          >
            View
          </Link>
          <button
            onClick={() => setShowActions(!showActions)}
            disabled={busy}
            className="px-3 py-1.5 text-xs font-ui font-medium text-muted border border-black/[0.08] rounded-lg hover:bg-black/[0.02] transition-colors disabled:opacity-50"
          >
            {busy ? "..." : "Actions"}
          </button>

          {showActions && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-black/[0.08] rounded-xl shadow-lg py-1 min-w-[140px]">
              {product.status === "active" && (
                <button
                  onClick={() => handleStatusChange("paused")}
                  className="block w-full text-left px-4 py-2 text-sm font-ui text-ink hover:bg-black/[0.02]"
                >
                  Pause Listing
                </button>
              )}
              {product.status === "paused" && (
                <button
                  onClick={() => handleStatusChange("active")}
                  className="block w-full text-left px-4 py-2 text-sm font-ui text-ink hover:bg-black/[0.02]"
                >
                  Activate
                </button>
              )}
              {product.status === "draft" && (
                <button
                  onClick={() => handleStatusChange("active")}
                  className="block w-full text-left px-4 py-2 text-sm font-ui text-ink hover:bg-black/[0.02]"
                >
                  Publish
                </button>
              )}
              {product.status !== "archived" && (
                <button
                  onClick={() => handleStatusChange("archived")}
                  className="block w-full text-left px-4 py-2 text-sm font-ui text-ink hover:bg-black/[0.02]"
                >
                  Archive
                </button>
              )}
              {product.status === "archived" && (
                <button
                  onClick={() => handleStatusChange("active")}
                  className="block w-full text-left px-4 py-2 text-sm font-ui text-ink hover:bg-black/[0.02]"
                >
                  Restore
                </button>
              )}
              <hr className="my-1 border-black/[0.04]" />
              <button
                onClick={handleDelete}
                className="block w-full text-left px-4 py-2 text-sm font-ui text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
              <button
                onClick={() => setShowActions(false)}
                className="block w-full text-left px-4 py-2 text-xs font-ui text-muted hover:bg-black/[0.02]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="font-display text-2xl text-ink">Listings</h1>
        <div className="flex gap-2">
          <Link
            href="/sell"
            className="px-4 py-2 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl text-sm font-ui font-medium hover:opacity-90 transition-opacity"
          >
            + New Product
          </Link>
          <Link
            href="/sell/service"
            className="px-4 py-2 border border-black/[0.08] bg-white rounded-xl text-sm font-ui font-medium text-ink hover:bg-black/[0.02] transition-colors"
          >
            + New Commission
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "product", "service"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-ui transition-colors ${
              filter === f
                ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white"
                : "bg-white border border-black/[0.08] text-ink hover:bg-black/[0.02]"
            }`}
          >
            {f === "all" ? "All" : f === "product" ? "Products" : "Commissions"}
            {" "}
            <span className="opacity-70">
              ({f === "all" ? products.length : products.filter((p) => p.listing_type === f).length})
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl bg-gray-100 animate-pulse aspect-[3/4]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-body text-muted">
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
