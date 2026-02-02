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
  const isDigital = product.delivery_type === "digital";
  const sellerName = product.seller?.display_name || product.seller?.username;

  return (
    <Link
      href={`/product/${product.id}`}
      className="group block"
    >
      {/* Image Container - Taller aspect ratio for gallery feel */}
      <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-gray-100 mb-4">
        <img
          src={imageUrl}
          alt={product.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Content - Clean and minimal */}
      <div className="space-y-1">
        {/* Title */}
        <h3 className="font-medium text-ink leading-snug line-clamp-2 group-hover:underline decoration-gray-300 underline-offset-2">
          {product.title}
        </h3>

        {/* Creator */}
        <Link
          href={`/studio/${product.seller?.username}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-ink transition-colors"
        >
          <img
            src={getOptimizedAvatarUrl(product.seller?.avatar_url, 20) || DEFAULT_AVATAR}
            alt={sellerName || "Seller"}
            className="w-5 h-5 rounded-full object-cover"
          />
          <span className="truncate">{sellerName}</span>
          {product.seller?.is_verified && (
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </Link>

        {/* Price */}
        <div className="pt-1">
          {price !== undefined ? (
            <span className="text-lg font-semibold text-ink">
              {hasMultiplePrices && <span className="text-sm font-normal text-gray-500">From </span>}
              ${price.toFixed(2)}
            </span>
          ) : (
            <span className="text-sm text-gray-500">Price on request</span>
          )}
        </div>

        {/* Digital badge */}
        {isDigital && (
          <div className="pt-1">
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Digital download
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
