export default function TakeDetailLoading() {
  return (
    <div className="max-w-2xl mx-auto py-6 px-4 animate-pulse">
      {/* Video placeholder */}
      <div className="aspect-video bg-gray-800 rounded-xl mb-4" />

      {/* Author row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="space-y-1.5">
          <div className="h-4 w-28 bg-gray-200 rounded" />
          <div className="h-3 w-20 bg-gray-100 rounded" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-3/4 bg-gray-100 rounded" />
      </div>
    </div>
  );
}
