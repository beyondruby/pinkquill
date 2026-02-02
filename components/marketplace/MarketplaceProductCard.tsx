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
      {/* Image Container - Gallery Frame Style */}
      <div className="relative aspect-[4/5] overflow-hidden bg-gray-50 mb-4">
        {/* Main Image */}
        <img
          src={imageUrl}
          alt={product.title}
          className="w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03]"
        />

        {/* Subtle hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Digital badge - refined */}
        {isDigital && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/95 backdrop-blur-sm">
            <span className="font-ui text-[0.65rem] font-medium tracking-wide text-purple-primary uppercase">
              Digital
            </span>
          </div>
        )}

        {/* Quick view on hover - elegant approach */}
        <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <div className="text-center">
            <span className="inline-block px-5 py-2 bg-white text-sm font-ui font-medium text-ink shadow-sm">
              View Work
            </span>
          </div>
        </div>
      </div>

      {/* Content - Clean and Minimal */}
      <div className="space-y-2">
        {/* Title */}
        <h3 className="font-display text-base font-medium text-ink leading-snug line-clamp-2 group-hover:text-pink-vivid transition-colors duration-200">
          {product.title}
        </h3>

        {/* Creator - Subtle */}
        <div className="flex items-center gap-2">
          <img
            src={getOptimizedAvatarUrl(product.seller?.avatar_url, 24) || DEFAULT_AVATAR}
            alt={sellerName || "Creator"}
            className="w-5 h-5 rounded-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
          />
          <span className="font-body text-sm text-muted group-hover:text-ink transition-colors duration-200">
            {sellerName}
          </span>
          {product.seller?.is_verified && (
            <svg className="w-3.5 h-3.5 text-pink-vivid flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        {/* Price - Prominent */}
        <div className="pt-1">
          {price !== undefined ? (
            <span className="font-display text-lg text-ink font-medium tracking-tight">
              {hasMultiplePrices && <span className="text-sm text-muted font-body font-normal">From </span>}
              ${price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          ) : (
            <span className="font-ui text-sm text-muted tracking-wide">Inquire for price</span>
          )}
        </div>
      </div>
    </Link>
  );
}
