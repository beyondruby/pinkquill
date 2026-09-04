"use client";

import React from "react";
import Image from "next/image";

interface MarketplaceHeroProps {
  listingType: "product" | "service";
}

export default function MarketplaceHero({ listingType }: MarketplaceHeroProps) {
  const isService = listingType === "service";

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-surface rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-surface rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-12 py-12 sm:py-16 lg:py-20">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left: Text content */}
          <div className="w-full lg:w-1/2 text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-white leading-tight">
              {isService ? "Hire Top" : "Discover Original"}
              <br />
              <span className="text-white/90">{isService ? "Creative Talent" : "Creative Works"}</span>
            </h1>
            <p className="mt-4 sm:mt-6 text-lg sm:text-xl font-body text-white/80 max-w-lg mx-auto lg:mx-0">
              {isService
                ? "Book vetted creators for design, writing, video, and production services with clear packages and delivery timelines."
                : "Shop unique art, prints, digital downloads, and handcrafted pieces directly from independent creators."}
            </p>
          </div>

          {/* Right: Hero Image */}
          <div className="w-full lg:w-1/2 flex justify-center lg:justify-end">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 lg:w-96 lg:h-96">
              {/* Decorative circles behind */}
              <div className="absolute inset-0 bg-surface/10 rounded-full blur-2xl scale-110" />
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-surface/20 rounded-full blur-xl" />
              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-surface/15 rounded-full blur-xl" />

              {/* Main image container */}
              <div className="relative w-full h-full rounded-3xl overflow-hidden border-4 border-surface/20 shadow-2xl shadow-black/20 bg-surface/10 backdrop-blur-sm">
                <Image
                  src="/marketplace-hero-illustration.svg"
                  alt={isService ? "Creative professionals at work" : "Creative artwork"}
                  fill
                  sizes="(max-width: 1024px) 320px, 384px"
                  priority
                  className="object-cover"
                />
                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-purple-primary/20 to-transparent" />
              </div>

              {/* Floating accent elements */}
              <div className="absolute -top-3 -left-3 w-12 h-12 bg-surface rounded-xl shadow-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-surface rounded-xl shadow-lg flex items-center justify-center">
                <svg className="w-7 h-7 text-purple-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
                  <line x1="16" y1="8" x2="2" y2="22"/>
                </svg>
              </div>
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
