/** Loading placeholder shaped like a classic post card, on the skeleton token. */
export default function PostSkeleton() {
  return (
    <div className="pq-post-skeleton" aria-hidden="true">
      <div className="pq-post-skeleton__head">
        <span className="pq-skeleton pq-skeleton--round w-10 h-10" />
        <span className="grid gap-1.5 flex-1">
          <span className="pq-skeleton h-3 w-32" />
          <span className="pq-skeleton h-2.5 w-20" />
        </span>
      </div>
      <div className="pq-post-skeleton__lines">
        <span className="pq-skeleton h-3.5 w-full" />
        <span className="pq-skeleton h-3.5 w-full" />
        <span className="pq-skeleton h-3.5 w-3/4" />
        <span className="pq-skeleton h-3.5 w-1/2" />
      </div>
      <div className="pq-post-skeleton__foot">
        <span className="pq-skeleton h-6 w-14" />
        <span className="pq-skeleton h-6 w-14" />
        <span className="pq-skeleton h-6 w-14" />
      </div>
    </div>
  );
}
