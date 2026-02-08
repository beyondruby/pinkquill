"use client";

import Link from "next/link";
import SellerRating from "@/components/reviews/SellerRating";

interface SellerCardProps {
  seller: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
  className?: string;
}

export default function SellerCard({ seller, className = "" }: SellerCardProps) {
  return (
    <div className={`rounded-xl bg-gray-50 ${className}`}>
      <Link
        href={`/studio/${seller.username}`}
        className="flex items-center gap-3 p-3 hover:bg-gray-100 transition-colors group rounded-xl"
      >
        {/* Avatar */}
        <div className="relative">
          {seller.avatar_url ? (
            <img
              src={seller.avatar_url}
              alt={seller.display_name || seller.username}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white font-semibold text-lg">
              {(seller.display_name || seller.username).charAt(0).toUpperCase()}
            </div>
          )}
          {seller.is_verified && (
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-purple-primary rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-gray-900 truncate group-hover:text-purple-primary transition-colors">
              {seller.display_name || seller.username}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">@{seller.username}</p>
        </div>

        {/* Arrow */}
        <svg
          className="w-5 h-5 text-gray-400 group-hover:text-purple-primary group-hover:translate-x-0.5 transition-all"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
      <div className="px-3 pb-3">
        <SellerRating sellerId={seller.id} compact />
      </div>
    </div>
  );
}
