export default function InsightsLoading() {
  return (
    <div className="max-w-5xl mx-auto py-6 px-4 animate-pulse">
      {/* Header */}
      <div className="h-6 w-40 bg-gray-200 rounded mb-6" />

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-gray-100 rounded-xl border border-gray-200"
          />
        ))}
      </div>

      {/* Chart area */}
      <div className="h-72 bg-gray-100 rounded-xl border border-gray-200" />
    </div>
  );
}
