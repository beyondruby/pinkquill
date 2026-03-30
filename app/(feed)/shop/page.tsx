import { Suspense } from "react";
import { MarketplacePageContent } from "@/components/marketplace";

function ShopPageFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-orange-50/30">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-black/[0.04] shadow-sm animate-pulse">
              <div className="aspect-square bg-gradient-to-br from-orange-50 to-pink-50" />
              <div className="p-4 space-y-3">
                <div className="h-3 w-20 bg-gray-100 rounded" />
                <div className="h-4 w-3/4 bg-gray-100 rounded" />
                <div className="h-4 w-1/2 bg-gray-100 rounded" />
                <div className="h-6 w-16 bg-gradient-to-r from-purple-50 to-pink-50 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopPageFallback />}>
      <MarketplacePageContent />
    </Suspense>
  );
}
