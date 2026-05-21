export default function Loading() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="h-9 w-24 animate-pulse rounded-xl bg-white/10" />
          <div className="h-9 w-20 animate-pulse rounded-xl bg-white/10" />
          <div className="h-9 w-24 animate-pulse rounded-xl bg-white/10" />

          <div className="ml-auto h-4 w-28 animate-pulse rounded bg-white/10" />
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          {/* topo */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-6 w-56 animate-pulse rounded bg-white/10" />
              <div className="h-4 w-40 animate-pulse rounded bg-white/5" />
            </div>

            <div className="h-6 w-24 animate-pulse rounded-full bg-white/10" />
          </div>

          {/* cards */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--border)] bg-white/5 p-3"
              >
                <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
                <div className="mt-2 h-5 w-40 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>

          {/* observações */}
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-white/5 p-3">
            <div className="h-3 w-24 animate-pulse rounded bg-white/5" />
            <div className="mt-2 h-5 w-full animate-pulse rounded bg-white/10" />
          </div>
        </div>
      </section>
    </main>
  );
}
