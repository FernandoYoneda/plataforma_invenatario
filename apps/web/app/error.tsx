"use client";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h1 className="text-lg font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Não foi possível carregar os dados agora. Verifique se a API está
          rodando.
        </p>

        <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/80">
          {error.message}
        </pre>

        <div className="mt-4 flex gap-2">
          <button
            onClick={reset}
            className="rounded-xl border border-[var(--border)] bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            Tentar novamente
          </button>

          <link
            href="/"
            className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm hover:brightness-110"
          >
            Voltar pra lista
          </link>
        </div>
      </div>
    </main>
  );
}
