export default function StudioLoading() {
  return (
    <div className="max-w-4xl mx-auto animate-pulse">
      {/* Cover */}
      <div className="h-48 bg-skeleton rounded-b-xl" />
      {/* Avatar + info */}
      <div className="px-6 -mt-12">
        <div className="w-24 h-24 rounded-full bg-gray-300 border-4 border-white" />
        <div className="mt-3 space-y-2">
          <div className="h-5 w-40 bg-skeleton rounded" />
          <div className="h-3 w-24 bg-skeleton rounded" />
          <div className="h-3 w-64 bg-skeleton rounded mt-2" />
        </div>
        <div className="flex gap-6 mt-4">
          <div className="h-4 w-20 bg-skeleton rounded" />
          <div className="h-4 w-20 bg-skeleton rounded" />
        </div>
      </div>
    </div>
  );
}
