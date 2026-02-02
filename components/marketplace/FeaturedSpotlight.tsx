"use client";

import React from "react";
import Link from "next/link";
import type { Product } from "@/lib/types/store";
import { getOptimizedAvatarUrl, DEFAULT_AVATAR } from "@/lib/utils/image";

interface FeaturedSpotlightProps {
  products: Product[];
}

export default function FeaturedSpotlight({ products }: FeaturedSpotlightProps) {
  if (products.length === 0) return null;

  // Get the first product's seller as the featured creator
  const featuredProduct = products[0];
  const seller = featuredProduct?.seller;

  if (!seller) return null;

  // Get up to 4 products from this seller
  const sellerProducts = products
    .filter((p) => p.seller_id === seller.id)
    .slice(0, 4);

  return (
    <div className="bg-gray-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          {/* Creator Info */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <Link href={`/studio/${seller.username}`}>
              <img
                src={getOptimizedAvatarUrl(seller.avatar_url, 56) || DEFAULT_AVATAR}
                alt={seller.display_name || seller.username}
                className="w-14 h-14 rounded-full object-cover"
              />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/studio/${seller.username}`}
                  className="font-semibold text-ink hover:underline"
                >
                  {seller.display_name || seller.username}
                </Link>
                {seller.is_verified && (
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-gray-500">Featured creator</p>
            </div>
          </div>

          {/* Product previews - horizontal scroll on mobile */}
          <div className="flex-1 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-3">
              {sellerProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="flex-shrink-0 group"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={product.primary_image_url || "/placeholder-product.jpg"}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* View store link */}
          <Link
            href={`/studio/${seller.username}?tab=store`}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-ink hover:bg-white rounded-lg transition-colors"
          >
            View store
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
