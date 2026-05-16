export default function UploadLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="h-8 w-24 bg-[var(--color-surface-card)] rounded-lg animate-pulse mb-8" />
      <div className="aspect-[3/2] bg-[var(--color-surface-card)] rounded-2xl animate-pulse mb-6" />
      <div className="space-y-4">
        <div className="h-10 w-full bg-[var(--color-surface-card)] rounded-xl animate-pulse" />
        <div className="h-10 w-full bg-[var(--color-surface-card)] rounded-xl animate-pulse" />
        <div className="h-24 w-full bg-[var(--color-surface-card)] rounded-xl animate-pulse" />
      </div>
    </div>
  );
}