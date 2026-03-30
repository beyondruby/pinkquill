export default function PostDetailLoading() {
  return (
    <div className="max-w-2xl mx-auto py-6 px-4 animate-pulse">
      {/* Author row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="space-y-1.5">
          <div className="h-4 w-28 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
        </div>
      </div>

      {/* Title */}
      <div className="h-5 w-3/4 bg-gray-200 rounded mb-4" />

      {/* Content lines */}
      <div className="space-y-2 mb-6">
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-5/6 bg-gray-100 rounded" />
        <div className="h-3 w-2/3 bg-gray-100 rounded" />
      </div>

      {/* Action bar */}
      <div className="flex gap-6 pt-4 border-t border-gray-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-12 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}
