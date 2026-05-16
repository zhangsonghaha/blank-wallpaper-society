export default function ProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-20 h-20 bg-[var(--color-surface-card)] rounded-full animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-32 bg-[var(--color-surface-card)] rounded animate-pulse" />
          <div className="h-4 w-48 bg-[var(--color-surface-card)] rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] bg-[var(--color-surface-card)] rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}