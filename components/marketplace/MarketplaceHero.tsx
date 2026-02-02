"use client";

import React from "react";

export default function MarketplaceHero() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-12 py-16 sm:py-20 lg:py-24">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-white leading-tight">
            Discover Original
            <br />
            <span className="text-white/90">Creative Works</span>
          </h1>
          <p className="mt-4 sm:mt-6 text-lg sm:text-xl font-body text-white/80 max-w-lg">
            Shop unique art, prints, digital downloads, and handcrafted pieces directly from independent creators.
          </p>

          {/* Quick stats */}
          <div className="mt-8 sm:mt-10 flex items-center gap-8 sm:gap-12">
            <div>
              <div className="text-2xl sm:text-3xl font-display font-bold text-white">1,000+</div>
              <div className="text-sm font-body text-white/70">Unique Works</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <div className="text-2xl sm:text-3xl font-display font-bold text-white">500+</div>
              <div className="text-sm font-body text-white/70">Creators</div>
            </div>
            <div className="w-px h-10 bg-white/20 hidden sm:block" />
            <div className="hidden sm:block">
              <div className="text-2xl sm:text-3xl font-display font-bold text-white">100%</div>
              <div className="text-sm font-body text-white/70">Original</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" className="w-full h-auto">
          <path d="M0 60V30C240 10 480 0 720 10C960 20 1200 40 1440 30V60H0Z" fill="white" />
        </svg>
      </div>
    </div>
  );
}
