"use client";

import Link from "next/link";

export default function TrendingPageContent() {
  return (
    <div className="max-w-[580px] mx-auto py-12 px-6">
      <div className="text-center">
        <h1 className="font-display text-3xl text-ink mb-4">Trending</h1>
        <p className="font-body text-muted mb-6">
          Discover what's popular on PinkQuill right now.
        </p>
        <p className="font-body text-sm text-muted italic">
          Coming soon...
        </p>
        <Link
          href="/"
          className="inline-block mt-6 px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-white hover:opacity-90 transition-opacity"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
