"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerProducts, useUpdateProductStatus, useDeleteProduct } from "@/lib/hooks";
import type { DeleteListingResult } from "@/lib/content-client";
import ActionMenu from "@/components/ui/ActionMenu";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { showToast } from "@/lib/utils/toast";
import type { Product, ProductStatus } from "@/lib/types/store";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  active: { label: "Active", dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  paused: { label: "Paused", dot: "bg-yellow-400", bg: "bg-yellow-50", text: "text-yellow-700" },
  draft: { label: "Draft", dot: "bg-muted/60", bg: "bg-subtle", text: "text-ink/60" },
  sold: { label: "Sold", dot: "bg-purple-400", bg: "bg-purple-50", text: "text-purple-700" },
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
  onDelete: (id: string) => Promise<DeleteListingResult | null>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const primaryImage = product.primary_image_url || product.media?.[0]?.media_url;
  const isService = product.listing_type === "service";
  const statusConfig = STATUS_CONFIG[product.status || "draft"] || STATUS_CONFIG.draft;

  const handleStatusChange = useCallback(async (status: ProductStatus) => {
    setBusy(true);
    await onStatusChange(product.id, status);
    setBusy(false);
  }, [product.id, onStatusChange]);

  const handleDelete = useCallback(async () => {
    try {
      setBusy(true);
      const result = await onDelete(product.id);
      if (!result) {
        showToast.error("Failed to delete listing", "Please try again");
      } else if (result.outcome === "archived") {
        showToast.info(
          "Listing archived",
          "This listing has order history, so it was archived instead of permanently deleted."
        );
      } else {
        showToast.success("Listing deleted");
      }
    } catch {
      showToast.error("Failed to delete listing", "Please try again");
    } finally {
      setBusy(false);
      setShowDeleteConfirm(false);
    }
  }, [product.id, onDelete]);

  return (
    <div className="rounded-xl border border-border-light bg-surface overflow-hidden group hover:shadow-sm hover:border-border-light transition-all">
      {/* Image */}
      <div className="aspect-[4/3] bg-subtle relative overflow-hidden">
        {primaryImage ? (
          <Image src={primaryImage} alt="" fill className="object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-10 h-10 text-muted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
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
        <span className="absolute top-2.5 right-2.5 text-[10px] font-ui font-medium px-2 py-0.5 rounded-full bg-surface/90 text-ink backdrop-blur-sm border border-border-light">
          {isService ? "Commission" : "Product"}
        </span>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="font-ui text-sm font-semibold text-ink truncate">{product.title}</h3>
        <div className="flex items-center justify-between mt-1.5">
          <span className="font-display text-sm font-bold text-purple-primary">
            {product.min_price != null
              ? product.min_price === 0
                ? (product.max_price ?? 0) > 0
                  ? "Free+"
                  : "Free"
                : product.min_price === product.max_price
                  ? `$${product.min_price.toFixed(2)}`
                  : `$${product.min_price.toFixed(2)} – $${product.max_price?.toFixed(2)}`
              : "No price"}
          </span>
          {product.category && (
            <span className="text-[10px] font-ui text-muted bg-subtle px-1.5 py-0.5 rounded">
              {product.category}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2 relative">
          <Link
            href={isService ? `/commissions/${product.id}` : `/product/${product.id}`}
            className="flex-1 text-center py-1.5 text-xs font-ui font-medium text-muted border border-border-light rounded-lg hover:bg-subtle transition-colors"
          >
            View
          </Link>
          <button
            onClick={() => {
              router.push(`/sell/edit/${product.id}`);
            }}
            className="flex-1 text-center py-1.5 text-xs font-ui font-medium text-ink border border-border-light rounded-lg hover:bg-subtle transition-colors"
          >
            Edit
          </button>
          <ActionMenu
            buttonClassName="px-2.5 py-1.5 text-xs font-ui text-muted border border-border-light rounded-lg hover:bg-subtle transition-colors disabled:opacity-50 flex items-center justify-center"
            buttonIconClassName="w-3.5 h-3.5"
            widthClassName="w-44"
            buttonDisabled={busy}
            items={[
              {
                label: "Pause Listing",
                onSelect: () => void handleStatusChange("paused"),
                hidden: product.status !== "active",
              },
              {
                label: "Activate",
                onSelect: () => void handleStatusChange("active"),
                tone: "success",
                hidden: product.status !== "paused" && product.status !== "draft" && product.status !== "archived",
              },
              {
                label: product.status === "archived" ? "Restore" : "Archive",
                onSelect: () => void handleStatusChange(product.status === "archived" ? "active" : "archived"),
                hidden: false,
              },
              {
                label: "Delete",
                onSelect: () => setShowDeleteConfirm(true),
                tone: "danger",
                dividerBefore: true,
              },
            ]}
          />
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Listing?"
        description="This action cannot be undone. This will permanently delete your listing and remove its associated data. If it already has order history, it will be archived instead."
        confirmText="Delete"
        isDanger
        loading={busy}
      />
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
    const result = await deleteProduct(productId);
    if (result) {
      await refetch();
    }
    return result;
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-primary text-white rounded-lg text-sm font-ui font-semibold hover:bg-accent/90 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Product
          </Link>
          <Link
            href="/sell/service"
            className="inline-flex items-center gap-2 px-4 py-2 border border-border-light bg-surface rounded-lg text-sm font-ui font-medium text-ink hover:bg-subtle transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Commission
          </Link>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="border-b border-border-light">
        <div className="flex gap-0 -mb-px">
          {(["all", "product", "service"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-3 text-sm font-ui font-medium border-b-2 transition-colors ${
                filter === f
                  ? "border-purple-primary text-purple-primary"
                  : "border-transparent text-muted hover:text-ink hover:border-border-light"
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
            <div key={i} className="rounded-xl bg-subtle animate-pulse border border-border-light aspect-[3/4]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-12 h-12 text-muted/40 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
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
