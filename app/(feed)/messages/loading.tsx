export default function MessagesLoading() {
  return (
    <div className="flex h-full animate-pulse">
      <div className="w-80 border-r border-gray-200 p-4 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-skeleton rounded w-24" />
              <div className="h-2 bg-skeleton rounded w-40" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted text-sm">Loading messages...</p>
      </div>
    </div>
  );
}
