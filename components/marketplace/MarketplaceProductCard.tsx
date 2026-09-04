"use client";

import React, { useState } from "react";
import AvailabilityPill from "@/components/commissions/AvailabilityPill";
import { COMMISSION_CATEGORIES, getCommissionSubcategoryLabel } from "@/lib/commissions/categories";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types/store";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToggleSaveProduct } from "@/lib/hooks/useProducts";
import { getOptimizedAvatarUrl, DEFAULT_AVATAR } from "@/lib/utils/image";

const CARD_IMAGE_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 320px";

interface MarketplaceProductCardProps {
  product: Product;
}

export default function MarketplaceProductCard({ product }: MarketplaceProductCardProps) {
  if (product.listing_type === "service") {
    return <CommissionMarketplaceCard product={product} />;
  }

  return <ProductMarketplaceCard product={product} />;
}

function CommissionMarketplaceCard({ product }: { product: Product }) {
  const imageUrl = product.primary_image_url || "/placeholder-product.svg";
  const sellerName = product.seller?.display_name || product.seller?.username || "Creator";
  const headline =
    typeof product.service_metadata?.headline === "string"
      ? product.service_metadata.headline
      : null;

  const sortedPackages = [...(product.pricing || [])].sort((a, b) => a.price - b.price);
  const minDeliveryDays = sortedPackages
    .map((pkg) => pkg.delivery_days)
    .filter((value): value is number => typeof value === "number" && value > 0)
    .sort((a, b) => a - b)[0];
  const maxRevisions = sortedPackages
    .map((pkg) => pkg.revisions)
    .filter((value): value is number => typeof value === "number" && value >= 0)
    .sort((a, b) => b - a)[0];

  const startingPrice = product.min_price;
  const packageCount = sortedPackages.length;
  const firstFeatures = sortedPackages
    .flatMap((pkg) => pkg.package_features || [])
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .slice(0, 2);

  return (
    <Link href={`/commissions/${product.id}`} className="group block h-full">
      <article className="h-full relative rounded-[24px] border border-border-light overflow-hidden bg-surface shadow-sm hover:shadow-2xl hover:shadow-pink-vivid/15 hover:-translate-y-1 transition-all duration-300">
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute -top-16 -right-12 w-40 h-40 rounded-full bg-pink-vivid/10 blur-2xl" />
          <div className="absolute -bottom-16 -left-12 w-40 h-40 rounded-full bg-purple-primary/10 blur-2xl" />
        </div>

        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-pink-50 to-orange-50">
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            sizes={CARD_IMAGE_SIZES}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />

          <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 bg-surface/90 text-pink-vivid text-xs font-ui font-semibold rounded-full border border-pink-vivid/15">
                Commission
              </span>
              <AvailabilityPill listing={product.commission_listing} className="bg-surface/90" />
            </div>
            {minDeliveryDays !== undefined && (
              <span className="px-2.5 py-1 bg-black/55 backdrop-blur text-white text-[0.65rem] font-ui font-medium rounded-full">
                {minDeliveryDays} day delivery
              </span>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/65 via-black/30 to-transparent">
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-surface/90 text-[11px] font-ui text-gray-700">
                {packageCount} tier{packageCount === 1 ? "" : "s"}
              </span>
              {maxRevisions !== undefined && (
                <span className="px-2 py-0.5 rounded-full bg-surface/90 text-[11px] font-ui text-gray-700">
                  {maxRevisions} revision{maxRevisions === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 flex flex-col h-[calc(100%-0px)]">
          <div className="flex items-center gap-2 mb-2">
            <Image
              src={getOptimizedAvatarUrl(product.seller?.avatar_url) || DEFAULT_AVATAR}
              alt={sellerName}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full object-cover ring-1 ring-black/[0.06]"
            />
            <span className="text-xs font-body text-muted truncate">{sellerName}</span>
            {product.seller?.is_verified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-ui text-pink-vivid">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Verified
              </span>
            )}
          </div>

          <p className="text-xs font-ui text-muted">
            {product.listing_type === "service"
              ? [COMMISSION_CATEGORIES[product.category]?.name || product.category, product.subcategory ? getCommissionSubcategoryLabel(product.category, product.subcategory) : null].filter(Boolean).join(" · ")
              : product.category}
          </p>

          <h3 className="mt-1 font-display text-base font-semibold text-ink leading-snug line-clamp-2 group-hover:text-pink-vivid transition-colors">
            {product.title}
          </h3>

          {headline && (
            <p className="mt-2 text-xs font-body text-muted line-clamp-2">{headline}</p>
          )}

          {firstFeatures.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {firstFeatures.map((feature) => (
                <span key={feature} className="px-2 py-0.5 rounded-full bg-skeleton text-[11px] font-ui text-gray-700">
                  {feature}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-border-light flex items-end justify-between gap-3">
            {startingPrice !== undefined ? (
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] font-body text-muted">From</span>
                <span className="text-xl font-display font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
                  ${startingPrice.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
            ) : (
              <span className="text-sm font-body text-muted">Price on request</span>
            )}

            <span className="inline-flex items-center gap-1 text-xs font-ui font-semibold text-pink-vivid group-hover:text-orange-warm transition-colors">
              Hire Now
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function ProductMarketplaceCard({ product }: { product: Product }) {
  const router = useRouter();
  const { user } = useAuth();
  const { toggle: toggleSave } = useToggleSaveProduct();
  const imageUrl = product.primary_image_url || "/placeholder-product.svg";
  const price = product.min_price;
  const hasMultiplePrices = product.min_price !== product.max_price;
  const isDigital = product.delivery_type === "digital";
  const sellerName = product.seller?.display_name || product.seller?.username || "Creator";

  // Saved state defaults to whatever the parent hook batch-fetched. Local
  // optimistic override only kicks in when the user toggles, so updates
  // from the parent (e.g. on filter change) don't get out of sync.
  const [optimisticSaved, setOptimisticSaved] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const isSavedForUi = user?.id
    ? optimisticSaved ?? Boolean(product.is_saved)
    : false;

  const handleToggleSave = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (saving) return;

    if (!user?.id) {
      router.push("/login");
      return;
    }

    const previousValue = isSavedForUi;
    const nextValue = !previousValue;

    setOptimisticSaved(nextValue);
    setSaving(true);

    const success = await toggleSave(product.id, user.id, previousValue);
    if (!success) {
      setOptimisticSaved(previousValue);
    }

    setSaving(false);
  };

  return (
    <Link href={`/product/${product.id}`} className="group block h-full">
      <article className="h-full rounded-[22px] overflow-hidden border border-border-light bg-surface shadow-sm hover:shadow-xl hover:shadow-pink-vivid/10 hover:-translate-y-1 transition-all duration-300">
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-orange-50 to-pink-50">
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            sizes={CARD_IMAGE_SIZES}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />

          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            {isDigital ? (
              <span className="px-2.5 py-1 rounded-full bg-purple-primary text-white text-xs font-ui font-medium">
                Digital
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-surface/90 text-ink text-xs font-ui font-medium">
                Physical
              </span>
            )}

            <button
              type="button"
              onClick={handleToggleSave}
              aria-label={isSavedForUi ? "Unsave product" : "Save product"}
              aria-pressed={isSavedForUi}
              className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm border transition-all ${
                isSavedForUi
                  ? "bg-surface text-pink-vivid border-pink-200 shadow-md"
                  : "bg-surface/90 text-gray-500 border-border-light hover:text-pink-vivid hover:border-pink-200"
              }`}
              disabled={saving}
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill={isSavedForUi ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M12.001 20.727l-.842-.764C6.284 15.53 3 12.548 3 8.91 3 5.93 5.4 3.5 8.4 3.5c1.7 0 3.334.79 4.4 2.026C13.866 4.29 15.5 3.5 17.2 3.5c3 0 5.4 2.43 5.4 5.41 0 3.638-3.284 6.62-8.16 11.053l-.839.764z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Image
              src={getOptimizedAvatarUrl(product.seller?.avatar_url) || DEFAULT_AVATAR}
              alt={sellerName}
              width={20}
              height={20}
              className="w-5 h-5 rounded-full object-cover ring-1 ring-black/[0.06]"
            />
            <span className="text-xs font-body text-muted truncate">{sellerName}</span>
            {product.seller?.is_verified && (
              <svg className="w-3.5 h-3.5 text-pink-vivid flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          <h3 className="font-display text-sm font-medium text-ink leading-snug line-clamp-2 mb-3 group-hover:text-pink-vivid transition-colors">
            {product.title}
          </h3>

          <div className="flex items-center justify-between">
            {price !== undefined ? (
              <div className="flex items-baseline gap-1">
                {price === 0 ? (
                  <span className="text-lg font-display font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
                    {(product.max_price ?? 0) > 0 ? "$0+" : "Free"}
                  </span>
                ) : (
                  <>
                    {hasMultiplePrices && <span className="text-xs font-body text-muted">From</span>}
                    <span className="text-lg font-display font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
                      ${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      {hasMultiplePrices && "+"}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <span className="text-sm font-body text-muted">Price on request</span>
            )}

            <span className="inline-flex items-center gap-1 text-xs font-ui font-semibold text-pink-vivid group-hover:text-orange-warm transition-colors">
              View
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
