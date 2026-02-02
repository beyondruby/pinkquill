"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";

interface MarketplaceHeroProps {
  onSearch: (query: string) => void;
  initialQuery?: string;
}

export default function MarketplaceHero({ onSearch, initialQuery = "" }: MarketplaceHeroProps) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);

      // Clear previous timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce search
      debounceRef.current = setTimeout(() => {
        onSearch(value);
      }, 400);
    },
    [onSearch]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-orange-50/60 via-white to-pink-50/40 border-b border-black/[0.04]">
      {/* Decorative blurs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-pink-200/30 rounded-full blur-3xl translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-64 h-64 bg-purple-200/20 rounded-full blur-3xl translate-x-1/2" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 lg:py-20">
        <div className="text-center max-w-2xl mx-auto">
          {/* Title */}
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-ink mb-4 leading-tight">
            Discover{" "}
            <span className="bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
              Creations
            </span>
          </h1>

          {/* Subtitle */}
          <p className="font-body text-muted text-base md:text-lg mb-8">
            Art, music, books, and more from talented creators around the world
          </p>

          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search for art, music, books..."
                className="w-full h-14 pl-14 pr-6 bg-white rounded-2xl border border-black/[0.08] shadow-lg shadow-black/[0.04] font-body text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-pink-vivid/30 focus:border-pink-vivid/40 transition-all duration-200"
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              {searchQuery && (
                <button
                  onClick={() => handleSearch("")}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Popular searches */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="font-ui text-xs text-muted">Popular:</span>
            {["Paintings", "Poetry Books", "Beats", "Prints", "Jewelry"].map((term) => (
              <button
                key={term}
                onClick={() => handleSearch(term)}
                className="px-3 py-1.5 bg-white/70 hover:bg-white border border-black/[0.06] rounded-full font-ui text-xs text-muted hover:text-pink-vivid transition-all duration-200"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
