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

  return (
    <Link
      href={`/product/${product.id}`}
      className="group block bg-white rounded-2xl overflow-hidden border border-black/[0.04] hover:border-pink-vivid/20 hover:shadow-xl hover:shadow-pink-vivid/[0.08] transition-all duration-300"
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-orange-50/50 to-pink-50/50">
        <img
          src={imageUrl}
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Digital badge */}
        {isDigital && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-full border border-black/[0.06]">
            <span className="font-ui text-[0.7rem] font-medium text-purple-primary flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Digital
            </span>
          </div>
        )}

        {/* Price pill on hover */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <div className="flex items-center justify-between">
            {price !== undefined ? (
              <span className="font-ui text-white font-semibold">
                {hasMultiplePrices ? "From " : ""}${price.toFixed(2)}
              </span>
            ) : (
              <span className="font-ui text-white/80 text-sm">Price on request</span>
            )}
            <span className="bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-full font-ui text-xs font-medium">
              View
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category */}
        <p className="font-ui text-[0.7rem] uppercase tracking-wide text-pink-vivid mb-1.5">
          {product.category?.replace(/_/g, " ")}
        </p>

        {/* Title */}
        <h3 className="font-display text-[0.95rem] font-medium text-ink leading-snug mb-3 line-clamp-2 group-hover:text-pink-vivid transition-colors duration-200">
          {product.title}
        </h3>

        {/* Seller */}
        <div className="flex items-center gap-2">
          <img
            src={getOptimizedAvatarUrl(product.seller?.avatar_url, 24) || DEFAULT_AVATAR}
            alt={product.seller?.display_name || product.seller?.username || "Seller"}
            className="w-6 h-6 rounded-full object-cover border border-black/[0.06]"
          />
          <span className="font-body text-xs text-muted truncate">
            {product.seller?.display_name || product.seller?.username}
          </span>
          {product.seller?.is_verified && (
            <svg className="w-3.5 h-3.5 text-pink-vivid flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>

        {/* Price - Desktop static */}
        <div className="mt-3 pt-3 border-t border-black/[0.04] flex items-center justify-between">
          {price !== undefined ? (
            <span className="font-ui text-ink font-semibold">
              {hasMultiplePrices ? "From " : ""}${price.toFixed(2)}
            </span>
          ) : (
            <span className="font-ui text-muted text-sm">Contact for price</span>
          )}
          {product.delivery_type === "both" && (
            <span className="font-ui text-[0.65rem] text-muted bg-gray-100 px-2 py-0.5 rounded-full">
              Physical + Digital
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
