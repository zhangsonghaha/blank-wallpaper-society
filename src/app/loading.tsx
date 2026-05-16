export default function Loading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8">
      {/* 标题骨架 */}
      <div className="mb-8">
        <div className="h-8 w-48 bg-[var(--color-surface-card)] rounded-lg animate-pulse mb-3" />
        <div className="h-4 w-80 bg-[var(--color-surface-card)] rounded animate-pulse" />
      </div>

      {/* 瀑布流骨架 */}
      <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="mb-4 break-inside-avoid"
            style={{ height: `${200 + Math.random() * 200}px` }}
          >
            <div className="w-full h-full bg-[var(--color-surface-card)] rounded-xl animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}