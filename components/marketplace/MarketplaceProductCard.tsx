"use client";

import React from "react";
import Link from "next/link";
import type { Product } from "@/lib/types/store";
import { getOptimizedAvatarUrl, DEFAULT_AVATAR } from "@/lib/utils/image";

interface MarketplaceProductCardProps {
  product: Product;
}

export default function MarketplaceProductCard({ product }: MarketplaceProductCardProps) {
  const imageUrl = product.primary_image_url || "/placeholder-product.jpg";
  const price = product.min_price;
  const hasMultiplePrices = product.min_price !== product.max_price;
  const isService = product.listing_type === "service";
  const isDigital = !isService && product.delivery_type === "digital";
  const sellerName = product.seller?.display_name || product.seller?.username;
  const minDeliveryDays = isService
    ? (product.pricing || [])
        .map((pkg) => pkg.delivery_days)
        .filter((days): days is number => days !== null && days !== undefined)
        .sort((a, b) => a - b)[0]
    : undefined;

  return (
    <Link
      href={isService ? `/commissions/${product.id}` : `/product/${product.id}`}
      className="group block"
    >
      {/* Card Container */}
      <div className="relative bg-white rounded-2xl overflow-hidden border border-black/[0.04] hover:border-pink-vivid/20 shadow-sm hover:shadow-xl hover:shadow-pink-vivid/10 transition-all duration-300">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-orange-50 to-pink-50">
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Badges - Top */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            {isService ? (
              <span className="px-2.5 py-1 bg-pink-vivid text-white text-[0.65rem] font-ui font-medium uppercase tracking-wide rounded-full shadow-lg">
                Commission
              </span>
            ) : isDigital && (
              <span className="px-2.5 py-1 bg-purple-primary text-white text-[0.65rem] font-ui font-medium uppercase tracking-wide rounded-full shadow-lg">
                Digital
              </span>
            )}
            {!isDigital && !isService && <span />}

            {/* Wishlist button placeholder */}
            <button
              onClick={(e) => {
                e.preventDefault();
                // TODO: Add to wishlist
              }}
              className="w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-white hover:scale-110"
            >
              <svg className="w-4 h-4 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>

          {/* Quick View - Bottom */}
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <span className="block text-center text-sm font-ui font-medium text-white">
              Quick View
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Creator Row */}
          <div className="flex items-center gap-2 mb-2">
            <img
              src={getOptimizedAvatarUrl(product.seller?.avatar_url, 24) || DEFAULT_AVATAR}
              alt={sellerName || "Creator"}
              className="w-5 h-5 rounded-full object-cover ring-1 ring-black/[0.06]"
            />
            <span className="text-xs font-body text-muted truncate flex-1">
              {sellerName}
            </span>
            {product.seller?.is_verified && (
              <svg className="w-3.5 h-3.5 text-pink-vivid flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          {/* Title */}
          <h3 className="font-display text-sm font-medium text-ink leading-snug line-clamp-2 mb-3 group-hover:text-pink-vivid transition-colors">
            {product.title}
          </h3>

          {/* Price Row */}
          <div className="flex items-center justify-between">
            {price !== undefined ? (
              <div className="flex items-baseline gap-1">
                {(hasMultiplePrices || isService) && (
                  <span className="text-xs font-body text-muted">From</span>
                )}
                <span className="text-lg font-display font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
                  ${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
            ) : (
              <span className="text-sm font-body text-muted">Price on request</span>
            )}

            {/* Add to cart icon */}
            <button
              onClick={(e) => {
                e.preventDefault();
                // TODO: Add to cart
              }}
              className="w-8 h-8 flex items-center justify-center bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 hover:shadow-lg hover:shadow-pink-vivid/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>

          {isService && minDeliveryDays !== undefined && (
            <div className="mt-2 pt-2 border-t border-black/[0.05] text-xs font-body text-muted">
              Delivery from {minDeliveryDays} day{minDeliveryDays === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
