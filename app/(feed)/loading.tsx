import PostSkeleton from "@/components/feed/PostSkeleton";

export default function FeedLoading() {
  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}
