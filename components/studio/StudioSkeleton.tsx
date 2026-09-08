/**
 * The profile's loading state, shaped like the real header so nothing jumps
 * when the data arrives (P-17). Used by the route's loading.tsx and by
 * StudioProfile while it fetches, so there is one loading visual.
 */
export default function StudioSkeleton() {
  return (
    <div className="min-h-screen bg-canvas animate-pulse" aria-busy="true" aria-label="Loading profile">
      <div className="relative h-[200px] md:h-[320px] overflow-hidden bg-skeleton/40" />
      <div className="relative max-w-[1100px] mx-auto px-4 md:px-8 -mt-[60px] md:-mt-[100px] pb-12">
        <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-8 mb-6 md:mb-8">
          <div className="w-24 h-24 md:w-40 md:h-40 rounded-full bg-skeleton border-4 border-surface shadow-xl mx-auto md:mx-0 shrink-0" />
          <div className="flex-1 pb-2 md:pb-4 flex flex-col items-center md:items-start gap-3">
            <div className="h-7 md:h-10 w-48 md:w-64 rounded-full bg-skeleton" />
            <div className="h-3 w-24 rounded-full bg-skeleton" />
            <div className="h-4 w-56 md:w-72 rounded-full bg-skeleton" />
          </div>
          <div className="flex justify-center md:justify-end gap-2 md:gap-3 pb-2 md:pb-4">
            <div className="h-10 md:h-12 w-28 md:w-36 rounded-full bg-skeleton" />
            <div className="h-10 md:h-12 w-10 md:w-12 rounded-full bg-skeleton" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 md:gap-6 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 py-3">
              <div className="h-6 w-10 rounded-full bg-skeleton" />
              <div className="h-3 w-14 rounded-full bg-skeleton" />
            </div>
          ))}
        </div>
        <div className="flex border-b border-border-light mb-8">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-1 flex justify-center py-3">
              <div className="h-4 w-5 md:w-20 rounded-full bg-skeleton" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 rounded-2xl bg-skeleton/60" />
          ))}
        </div>
      </div>
    </div>
  );
}
