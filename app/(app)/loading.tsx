export default function Loading() {
  return (
    <main className="space-y-3 px-4 pt-[max(18px,env(safe-area-inset-top))]" aria-busy="true" aria-live="polite">
      <p className="sr-only">Cargando…</p>
      <div className="h-6 w-40 animate-pulse rounded-[8px] bg-surface-2" />
      <div className="h-11 w-64 animate-pulse rounded-[10px] bg-surface-2" />
      <div className="h-52 animate-pulse rounded-[22px] bg-surface" />
      <div className="h-28 animate-pulse rounded-[22px] bg-surface" />
      <div className="h-40 animate-pulse rounded-[22px] bg-surface" />
    </main>
  );
}
