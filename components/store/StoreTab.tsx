"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSellerProducts, useDeleteProduct, useUpdateProductStatus } from "@/lib/hooks/useProducts";
import { Product, ProductStatus } from "@/lib/types/store";
import { getCategoryConfig, CATEGORY_ICONS } from "@/lib/store/categories";

interface StoreTabProps {
  userId: string;
  isOwnProfile: boolean;
  pageLoaded: boolean;
}

export default function StoreTab({ userId, isOwnProfile, pageLoaded }: StoreTabProps) {
  const { products, loading, error, refetch } = useSellerProducts(userId);
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
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-pink-vivid/20 border-t-pink-vivid animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-5 h-5 text-pink-vivid/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-muted font-body">Loading store...</p>
          </div>
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
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-pink-50/80 via-white to-orange-50/60 p-8 md:p-12 lg:p-16 border border-pink-100/50">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-warm/5 to-pink-vivid/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-pink-vivid/5 to-orange-warm/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative text-center">
            {/* Store icon */}
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-warm/10 to-pink-vivid/10 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-12 h-12 text-pink-vivid/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>

            <h3 className="font-display text-2xl md:text-3xl text-ink mb-4">
              {isOwnProfile ? (
                <>
                  Open Your{" "}
                  <span className="bg-gradient-to-r from-orange-warm to-pink-vivid bg-clip-text text-transparent">
                    Creative Store
                  </span>
                </>
              ) : (
                "No Products Yet"
              )}
            </h3>

            <p className="font-body text-muted text-base md:text-lg max-w-md mx-auto mb-8 leading-relaxed">
              {isOwnProfile
                ? "Transform your creativity into opportunity. Share your art, music, writings, and handcrafted treasures with the world."
                : "This creator hasn't listed any products yet. Check back later to discover their unique creations!"}
            </p>

            {isOwnProfile && (
              <Link
                href="/sell"
                className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-warm to-pink-vivid
                  text-white font-display font-medium text-lg rounded-2xl
                  hover:shadow-xl hover:shadow-pink-vivid/25 hover:scale-[1.02]
                  transition-all duration-300"
              >
                <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                List Your First Product
              </Link>
            )}

            {/* Feature highlights for own profile */}
            {isOwnProfile && (
              <div className="mt-12 grid grid-cols-3 gap-4 max-w-lg mx-auto">
                {[
                  { icon: "🎨", label: "Art & Prints" },
                  { icon: "📚", label: "Books & Zines" },
                  { icon: "🎵", label: "Music & Audio" },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/60 border border-pink-100/50">
                    <span className="text-2xl mb-1 block">{item.icon}</span>
                    <span className="text-xs text-muted font-ui">{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
      {/* Header with filters only (no add button) */}
      {showFilters && (
        <div className="flex items-center justify-start mb-8">
          <div className="flex items-center gap-1 p-1.5 bg-gradient-to-r from-orange-50 to-pink-50 rounded-2xl">
            {[
              { id: "all", label: "All", count: products.length },
              { id: "active", label: "Active", count: products.filter((p) => p.status === "active").length },
              { id: "inactive", label: "Inactive", count: inactiveCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`px-5 py-2.5 rounded-xl font-ui text-sm transition-all duration-200 ${
                  filter === tab.id
                    ? "bg-white text-pink-vivid shadow-sm font-medium"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 ${filter === tab.id ? "text-orange-warm" : "text-muted/60"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
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
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-muted font-body">No {filter} products found</p>
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { deleteProduct, deleting } = useDeleteProduct();
  const { updateStatus, updating } = useUpdateProductStatus();

  const categoryConfig = getCategoryConfig(product.category);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

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
      ? product.min_price === product.max_price
        ? formatPrice(product.min_price)
        : `From ${formatPrice(product.min_price)}`
      : null;

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/sell/edit/${product.id}`);
    setMenuOpen(false);
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newStatus: ProductStatus = product.status === "archived" ? "active" : "archived";
    const success = await updateStatus(product.id, newStatus);
    if (success) {
      await onRefetch();
    }
    setMenuOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    const success = await deleteProduct(product.id);
    if (success) {
      await onRefetch();
    }
    setMenuOpen(false);
    setConfirmDelete(false);
  };

  const handleActivate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const success = await updateStatus(product.id, "active");
    if (success) {
      await onRefetch();
    }
    setMenuOpen(false);
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
        className="block bg-white rounded-2xl overflow-hidden border border-gray-100/80
          hover:border-pink-200/60 hover:shadow-xl hover:shadow-pink-vivid/5
          transition-all duration-300 hover:-translate-y-1"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {/* Image Container */}
        <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          {product.primary_image_url ? (
            <img
              src={product.primary_image_url}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-gray-200">
                {CATEGORY_ICONS[categoryConfig?.icon || 'palette'] || (
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
            </div>
          )}

          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Status badge (only for own profile) */}
          {isOwnProfile && getStatusBadge()}

          {/* Digital badge */}
          {product.delivery_type === "digital" && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-ui font-medium
              bg-gradient-to-r from-orange-warm/90 to-pink-vivid/90 text-white backdrop-blur-sm
              flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Digital
            </div>
          )}

          {/* Price tag on hover */}
          {priceDisplay && (
            <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-sm font-display font-semibold
              bg-white/95 backdrop-blur-sm text-pink-vivid
              opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0
              transition-all duration-300">
              {priceDisplay}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Category pill */}
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 text-[10px] font-ui font-medium uppercase tracking-wider
              bg-gradient-to-r from-orange-50 to-pink-50 text-pink-vivid/80 rounded-md">
              {categoryConfig?.name || product.category}
            </span>
            {product.year_created && (
              <span className="text-[10px] text-muted font-ui">{product.year_created}</span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-display font-medium text-ink text-sm leading-snug line-clamp-2
            group-hover:text-pink-vivid transition-colors duration-200">
            {product.title}
          </h3>

          {/* Mobile price (visible on non-hover) */}
          {priceDisplay && (
            <p className="mt-2 text-sm font-display font-semibold text-pink-vivid md:hidden">
              {priceDisplay}
            </p>
          )}
        </div>
      </Link>

      {/* Actions menu button (only for own profile) */}
      {isOwnProfile && (
        <div ref={menuRef} className="absolute top-3 right-3 z-10">
          {/* Menu button - always visible on own profile */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(!menuOpen);
              setConfirmDelete(false);
            }}
            className={`w-8 h-8 rounded-full backdrop-blur-sm flex items-center justify-center
              transition-all duration-200
              ${menuOpen
                ? "bg-white shadow-lg"
                : "bg-black/30 opacity-0 group-hover:opacity-100 hover:bg-white hover:shadow-lg"
              }
              ${product.delivery_type === "digital" ? "translate-x-[-70px]" : ""}`}
          >
            <svg className={`w-4 h-4 ${menuOpen ? "text-ink" : "text-white group-hover:text-ink"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20">
              {/* Edit */}
              <button
                onClick={handleEdit}
                className="w-full px-4 py-3 text-left text-sm font-ui text-ink hover:bg-gray-50
                  flex items-center gap-3 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </button>

              {/* Activate (only for inactive products) */}
              {product.status !== "active" && product.status !== "sold" && (
                <button
                  onClick={handleActivate}
                  disabled={updating}
                  className="w-full px-4 py-3 text-left text-sm font-ui text-emerald-600 hover:bg-emerald-50
                    flex items-center gap-3 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {updating ? "Activating..." : "Activate"}
                </button>
              )}

              {/* Archive/Unarchive */}
              <button
                onClick={handleArchive}
                disabled={updating}
                className="w-full px-4 py-3 text-left text-sm font-ui text-ink hover:bg-gray-50
                  flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {updating ? "Updating..." : product.status === "archived" ? "Unarchive" : "Archive"}
              </button>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Delete */}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`w-full px-4 py-3 text-left text-sm font-ui
                  flex items-center gap-3 transition-colors disabled:opacity-50
                  ${confirmDelete
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "text-red-500 hover:bg-red-50"
                  }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deleting ? "Deleting..." : confirmDelete ? "Confirm Delete" : "Delete"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
