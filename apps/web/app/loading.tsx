export default function Loading() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
          <div className="h-6 w-40 animate-pulse rounded bg-white/10" />

          <div className="ml-auto flex gap-2">
            <div className="h-9 w-32 animate-pulse rounded-xl bg-white/10" />
            <div className="h-9 w-32 animate-pulse rounded-xl bg-white/10" />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          {/* Título */}
          <div className="mb-4">
            <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-4 w-72 animate-pulse rounded bg-white/5" />
          </div>

          {/* Skeleton da tabela */}
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="grid grid-cols-7 gap-3 rounded-xl border border-[var(--border)] bg-white/5 p-3"
              >
                <div className="h-4 animate-pulse rounded bg-white/10" />
                <div className="h-4 animate-pulse rounded bg-white/10" />
                <div className="h-4 animate-pulse rounded bg-white/10" />
                <div className="h-4 animate-pulse rounded bg-white/10" />
                <div className="h-4 animate-pulse rounded bg-white/10" />
                <div className="h-4 animate-pulse rounded bg-white/10" />
                <div className="h-4 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
