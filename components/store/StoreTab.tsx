"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSellerProducts, useDeleteProduct, useUpdateProductStatus } from "@/lib/hooks/useProducts";
import { Product, ProductStatus } from "@/lib/types/store";
import { getCategoryConfig, CATEGORY_ICONS } from "@/lib/store/categories";
import ActionMenu from "@/components/ui/ActionMenu";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import Loading from "@/components/ui/Loading";
import { showToast } from "@/lib/utils/toast";

interface StoreTabProps {
  userId: string;
  isOwnProfile: boolean;
  pageLoaded: boolean;
}

export default function StoreTab({ userId, isOwnProfile, pageLoaded }: StoreTabProps) {
  const { products, loading, error, refetch } = useSellerProducts(userId, { listingType: "product" });
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  // Filter products based on status
  const filteredProducts = products.filter((product) => {
    if (filter === "all") return true;
    if (filter === "active") return product.status === "active";
    if (filter === "inactive") return ["draft", "paused", "archived"].includes(product.status);
    return true;
  });

  // Only show filter controls for own profile
  const showFilters = isOwnProfile && products.length > 0;

  // Count inactive products (draft, paused, archived)
  const inactiveCount = products.filter((p) => ["draft", "paused", "archived"].includes(p.status)).length;

  if (loading) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="flex items-center justify-center py-16">
          <Loading text="Opening the store" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-red-500 font-medium mb-2">Failed to load products</p>
          <p className="text-sm text-muted">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="rounded-3xl border border-border-light bg-subtle/40 px-6 py-14 md:py-16 text-center">
          <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-surface border border-border-light flex items-center justify-center">
            <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>

          <h3 className="font-display text-xl md:text-2xl text-ink mb-2">
            {isOwnProfile ? "Your shelf is still bare" : "Nothing on the shelf yet"}
          </h3>

          <p className="font-body text-muted text-[0.95rem] max-w-sm mx-auto mb-7 leading-relaxed">
            {isOwnProfile
              ? "Set out your first piece — a print, a zine, a download — and your store opens for visitors."
              : "This creator hasn't listed anything yet. Slip back later to see what they put out."}
          </p>

          {isOwnProfile && (
            <Link
              href="/sell"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-semibold hover:shadow-lg hover:shadow-pink-vivid/25 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              List your first product
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
      {showFilters && (
        <div className="flex items-center gap-1.5 mb-8 overflow-x-auto scrollbar-hide">
          {[
            { id: "all", label: "All", count: products.length },
            { id: "active", label: "Active", count: products.filter((p) => p.status === "active").length },
            { id: "inactive", label: "Inactive", count: inactiveCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as typeof filter)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full font-ui text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                filter === tab.id
                  ? "bg-pink-vivid/10 text-pink-vivid"
                  : "text-muted hover:text-ink hover:bg-subtle"
              }`}
            >
              {tab.label}
              <span className={`ml-1 tabular-nums ${filter === tab.id ? "text-pink-vivid/60" : "text-muted/50"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5 md:gap-6">
        {filteredProducts.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            isOwnProfile={isOwnProfile}
            index={index}
            onRefetch={refetch}
          />
        ))}
      </div>

      {/* Empty filtered state */}
      {filteredProducts.length === 0 && products.length > 0 && (
        <div className="rounded-2xl border border-border-light bg-subtle/40 py-12 text-center">
          <p className="font-ui text-sm text-muted">Nothing in <span className="capitalize">{filter}</span> just yet.</p>
        </div>
      )}
    </div>
  );
}

// Product Card with action menu
function ProductCard({
  product,
  isOwnProfile,
  index,
  onRefetch,
}: {
  product: Product;
  isOwnProfile: boolean;
  index: number;
  onRefetch: () => Promise<void>;
}) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { deleteProduct, deleting } = useDeleteProduct();
  const { updateStatus, updating } = useUpdateProductStatus();

  const categoryConfig = getCategoryConfig(product.category);

  // Format price display
  const formatPrice = (price?: number) => {
    if (price === undefined) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const priceDisplay =
    product.min_price !== undefined
      ? product.min_price === 0
        ? (product.max_price ?? 0) > 0
          ? "Free+"
          : "Free"
        : product.min_price === product.max_price
          ? formatPrice(product.min_price)
          : `From ${formatPrice(product.min_price)}`
      : null;

  const handleEdit = () => {
    router.push(`/sell/edit/${product.id}`);
  };

  const handleArchive = async () => {
    const newStatus: ProductStatus = product.status === "archived" ? "active" : "archived";
    const success = await updateStatus(product.id, newStatus);
    if (success) {
      await onRefetch();
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const result = await deleteProduct(product.id);
      if (result?.outcome === "deleted") {
        showToast.success("Product deleted");
        await onRefetch();
      } else if (result?.outcome === "archived") {
        showToast.info(
          "Product archived",
          "This listing has order history, so it was archived instead of permanently deleted."
        );
        await onRefetch();
      } else {
        showToast.error("Failed to delete product", "Please try again");
      }
    } catch {
      showToast.error("Failed to delete product", "Please try again");
    } finally {
      setShowDeleteModal(false);
    }
  };

  const handleActivate = async () => {
    const success = await updateStatus(product.id, "active");
    if (success) {
      await onRefetch();
    }
  };

  const getStatusBadge = () => {
    if (product.status === "active") return null;

    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: "bg-amber-500/90", text: "text-white", label: "Draft" },
      paused: { bg: "bg-gray-500/90", text: "text-white", label: "Paused" },
      archived: { bg: "bg-slate-600/90", text: "text-white", label: "Archived" },
      sold: { bg: "bg-emerald-500/90", text: "text-white", label: "Sold" },
    };

    const config = statusConfig[product.status] || statusConfig.paused;

    return (
      <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-ui font-medium backdrop-blur-sm ${config.bg} ${config.text}`}>
        {config.label}
      </div>
    );
  };

  return (
    <div className="relative group">
      <Link
        href={`/product/${product.id}`}
        className="block transition-all duration-500 hover:-translate-y-2"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {/* Minimalist Card */}
        <div className="relative">
          {/* Image Container - Clean rounded square */}
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-pink-50/50 to-orange-50/30">
            {product.primary_image_url ? (
              <img
                src={product.primary_image_url}
                alt={product.title}
                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-pink-vivid/20">
                  {CATEGORY_ICONS[categoryConfig?.icon || 'palette'] || (
                    <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
              </div>
            )}

            {/* Elegant gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent
              opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Status badge (only for own profile) - top left */}
            {isOwnProfile && getStatusBadge()}

            {/* Digital indicator - subtle top right */}
            {product.delivery_type === "digital" && (
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full
                bg-surface/90 backdrop-blur-sm flex items-center justify-center
                shadow-sm">
                <svg className="w-4 h-4 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
            )}

            {/* Price - appears on hover at bottom */}
            {priceDisplay && (
              <div className="absolute bottom-4 left-4 right-4
                opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0
                transition-all duration-500">
                <div className="inline-block px-4 py-2 rounded-full
                  bg-surface/95 backdrop-blur-sm shadow-sm">
                  <span className="text-base font-display font-bold text-pink-vivid">
                    {priceDisplay}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Text content - minimal and clean */}
          <div className="mt-4 px-1">
            {/* Title */}
            <h3 className="font-display font-semibold text-ink text-base leading-snug line-clamp-1
              group-hover:text-pink-vivid transition-colors duration-300">
              {product.title}
            </h3>

            {/* Subtitle row - category and year */}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-sm text-muted/80 font-body">
                {categoryConfig?.name || product.category}
              </span>
              {product.year_created && (
                <>
                  <span className="w-1 h-1 rounded-full bg-muted/30" />
                  <span className="text-sm text-muted/60 font-body">{product.year_created}</span>
                </>
              )}
            </div>

            {/* Price - always visible on mobile */}
            {priceDisplay && (
              <p className="mt-2 text-lg font-display font-bold text-pink-vivid md:hidden">
                {priceDisplay}
              </p>
            )}
          </div>
        </div>
      </Link>

      {/* Actions menu button (only for own profile) */}
      {isOwnProfile && (
        <div className={`absolute top-3 z-10 ${product.delivery_type === "digital" ? "right-14" : "right-3"}`}>
          <ActionMenu
            buttonClassName="w-8 h-8 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all duration-200 text-white"
            buttonIconClassName="w-4 h-4"
            widthClassName="w-44"
            items={[
              {
                label: "Edit",
                onSelect: handleEdit,
                icon: (
                  <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                ),
              },
              {
                label: "Activate",
                onSelect: () => void handleActivate(),
                tone: "success",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                hidden: product.status === "active" || product.status === "sold",
                disabled: updating,
              },
              {
                label: product.status === "archived" ? "Unarchive" : "Archive",
                onSelect: () => void handleArchive(),
                icon: (
                  <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                ),
                disabled: updating,
              },
              {
                label: "Delete",
                onSelect: handleDeleteClick,
                tone: "danger",
                dividerBefore: true,
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ),
                disabled: deleting,
              },
            ]}
          />
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Take this listing off the shelf?"
        description="This product will disappear from your store for good. If past orders are tied to it, we'll quietly archive it instead so the records hold."
        confirmText="Erase it"
        isDanger
        loading={deleting}
      />
    </div>
  );
}
