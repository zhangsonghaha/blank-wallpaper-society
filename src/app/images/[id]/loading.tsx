export default function ImageDetailLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 图片骨架 */}
        <div className="aspect-[4/3] bg-[var(--color-surface-card)] rounded-2xl animate-pulse" />

        {/* 信息骨架 */}
        <div className="space-y-4">
          <div className="h-8 w-3/4 bg-[var(--color-surface-card)] rounded-lg animate-pulse" />
          <div className="h-4 w-1/2 bg-[var(--color-surface-card)] rounded animate-pulse" />
          <div className="h-4 w-2/3 bg-[var(--color-surface-card)] rounded animate-pulse" />
          <div className="flex gap-3 mt-6">
            <div className="h-10 w-24 bg-[var(--color-surface-card)] rounded-full animate-pulse" />
            <div className="h-10 w-24 bg-[var(--color-surface-card)] rounded-full animate-pulse" />
            <div className="h-10 w-24 bg-[var(--color-surface-card)] rounded-full animate-pulse" />
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-4 w-full bg-[var(--color-surface-card)] rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-[var(--color-surface-card)] rounded animate-pulse" />
          </div>
          <div className="flex gap-2 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 w-16 bg-[var(--color-surface-card)] rounded-full animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}