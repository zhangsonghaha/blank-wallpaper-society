export default function AdminLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="h-8 w-32 bg-[var(--color-surface-card)] rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-[var(--color-surface-card)] rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-[var(--color-surface-card)] rounded-xl animate-pulse" />
    </div>
  );
}