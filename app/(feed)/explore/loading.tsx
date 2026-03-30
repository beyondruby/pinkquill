import PostSkeleton from "@/components/feed/PostSkeleton";

export default function ExploreLoading() {
  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
      <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}
