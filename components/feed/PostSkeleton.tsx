/**
 * Classic-card skeleton shaped like the real card: the `.post` shell (radius,
 * padding, border), a 44px avatar, name + meta, three text lines and the
 * 3 + 2 action row, all in theme tokens (F-22).
 */
export default function PostSkeleton() {
  return (
    <div className="post pq-feed-card animate-pulse" aria-hidden="true">
      <div className="author-header">
        <div className="w-11 h-11 rounded-full bg-skeleton shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-3.5 w-36 rounded-full bg-skeleton" />
          <div className="h-3 w-24 rounded-full bg-skeleton" />
        </div>
      </div>
      <div className="flex flex-col gap-2.5 mb-5">
        <div className="h-3.5 w-full rounded-full bg-skeleton" />
        <div className="h-3.5 w-full rounded-full bg-skeleton" />
        <div className="h-3.5 w-3/4 rounded-full bg-skeleton" />
        <div className="h-3.5 w-1/2 rounded-full bg-skeleton" />
      </div>
      <div className="actions">
        <div className="actions-left">
          <div className="h-8 w-16 rounded-full bg-skeleton" />
          <div className="h-8 w-14 rounded-full bg-skeleton" />
          <div className="h-8 w-14 rounded-full bg-skeleton" />
        </div>
        <div className="actions-right">
          <div className="h-8 w-8 rounded-full bg-skeleton" />
          <div className="h-8 w-8 rounded-full bg-skeleton" />
        </div>
      </div>
    </div>
  );
}
