export const SkeletonGrid = () => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-border/70 bg-card p-3 shadow-card">
        <div className="skeleton-shimmer h-40 rounded-xl" />
        <div className="mt-3 space-y-2">
          <div className="skeleton-shimmer h-4 w-5/6 rounded" />
          <div className="skeleton-shimmer h-4 w-2/3 rounded" />
          <div className="skeleton-shimmer h-3 w-1/2 rounded" />
        </div>
      </div>
    ))}
  </div>
);
