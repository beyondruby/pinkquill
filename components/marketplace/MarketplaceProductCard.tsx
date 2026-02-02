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
      {/* Image Container */}
      <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-gradient-to-br from-orange-50/50 to-pink-50/50 mb-3">
        <img
          src={imageUrl}
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Digital badge */}
        {isDigital && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-full">
            <span className="font-ui text-[0.65rem] font-medium text-purple-primary flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Digital
            </span>
          </div>
        )}

        {/* Price on hover - bottom */}
        <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {price !== undefined && (
            <span className="inline-block px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full font-ui text-sm font-semibold text-ink shadow-lg">
              {hasMultiplePrices ? "From " : ""}${price.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-1.5">
        {/* Title */}
        <h3 className="font-display text-[0.95rem] font-medium text-ink leading-snug line-clamp-2 group-hover:text-pink-vivid transition-colors duration-200">
          {product.title}
        </h3>

        {/* Creator */}
        <div className="flex items-center gap-2">
          <img
            src={getOptimizedAvatarUrl(product.seller?.avatar_url, 22) || DEFAULT_AVATAR}
            alt={sellerName || "Seller"}
            className="w-5 h-5 rounded-full object-cover ring-1 ring-black/[0.04]"
          />
          <span className="font-body text-sm text-muted truncate">{sellerName}</span>
          {product.seller?.is_verified && (
            <svg className="w-3.5 h-3.5 text-pink-vivid flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        {/* Price - static (mobile/always visible) */}
        <div className="pt-0.5">
          {price !== undefined ? (
            <span className="font-ui text-ink font-semibold">
              {hasMultiplePrices && <span className="text-muted font-normal">From </span>}
              ${price.toFixed(2)}
            </span>
          ) : (
            <span className="font-ui text-sm text-muted">Price on request</span>
          )}
        </div>
      </div>
    </Link>
  );
}
