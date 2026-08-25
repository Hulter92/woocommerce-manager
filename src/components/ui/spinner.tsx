export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      role="status"
      aria-label="Laddar"
    />
  );
}

export function LoadingBlock({ label = "Laddar…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-muted text-sm py-10 justify-center">
      <Spinner />
      {label}
    </div>
  );
}
