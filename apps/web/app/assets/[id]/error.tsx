"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm">
        <h1 className="text-lg font-semibold text-rose-200">
          Algo deu errado 😕
        </h1>

        <p className="mt-2 text-rose-200/80">
          {error.message || "Erro inesperado ao carregar o ativo."}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => reset()}
            className="rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-100 hover:bg-rose-500/20"
          >
            Tentar novamente
          </button>

          <Link
            href="/"
            className="rounded-xl border border-[var(--border)] bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            Voltar para lista
          </Link>
        </div>
      </div>
    </main>
  );
}
