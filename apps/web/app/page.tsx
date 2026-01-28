import HeaderActions from "../components/HeaderActions";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Asset = {
  id: string;
  internalCode: string;
  type: string;
  brand: string;
  model?: string | null;
  serialNumber?: string | null;
  valueCents?: number | null;
  status: string;
  registeredAt: string;
};

async function fetchAssets(filters: {
  q?: string;
  type?: string;
  status?: string;
}): Promise<Asset[]> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
  const url = new URL("/assets", base);

  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.type) url.searchParams.set("type", filters.type);
  if (filters.status) url.searchParams.set("status", filters.status);

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // tenta mostrar o json do Nest quando vier {"statusCode":...,"message":...}
    let detail = txt;
    try {
      const j = JSON.parse(txt);
      detail = j?.message ? JSON.stringify(j.message) : txt;
    } catch {}

    throw new Error(
      `Falha ao buscar ativos (${res.status}). ${
        detail ? `Detalhe: ${detail}` : ""
      }`
    );
  }

  return res.json();
}

function moneyBRL(valueCents?: number | null) {
  if (valueCents == null) return "-";
  return (valueCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusBadge(status: string) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs";
  const map: Record<string, string> = {
    EM_USO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    ESTOQUE: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    MANUTENCAO: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    BAIXADO: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  };
  return `${base} ${map[status] ?? "border-white/10 bg-white/5 text-white/80"}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string }>;
}) {
  const sp = await searchParams;

  const q = sp?.q ?? "";
  const type = sp?.type ?? "";
  const status = sp?.status ?? "";

  let assets: Asset[] = [];
  let errorMsg: string | null = null;

  try {
    assets = await fetchAssets({
      q: q || undefined,
      type: type || undefined,
      status: status || undefined,
    });
  } catch (e: unknown) {
    errorMsg = e instanceof Error ? e.message : "Erro ao buscar ativos.";
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <img
            src="/LOGO-CASABELLA-CIRCULO.png"
            alt="Casabella"
            className="h-10 w-10"
          />
          <img
            src="/LOGO-CASABELLA-ESCRITA.png"
            alt="Casabella"
            className="hidden h-8 sm:block"
          />

          {/* Tudo no mesmo FORM para enviar q/type/status juntos */}
          <form className="ml-auto flex flex-wrap items-center gap-2">
            {/* Botão Novo Ativo (client component) */}
            <HeaderActions />

            <select
              name="type"
              defaultValue={type}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none"
            >
              <option value="">Tipo (todos)</option>
              <option value="DESKTOP">Desktop</option>
              <option value="NOTEBOOK">Notebook</option>
              <option value="MONITOR">Monitor</option>
              <option value="MOUSE">Mouse</option>
              <option value="TECLADO">Teclado</option>
              <option value="OUTRO">Outro</option>
            </select>

            <select
              name="status"
              defaultValue={status}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none"
            >
              <option value="">Status (todos)</option>
              <option value="EM_USO">Em uso</option>
              <option value="ESTOQUE">Estoque</option>
              <option value="MANUTENCAO">Manutenção</option>
              <option value="BAIXADO">Baixado</option>
            </select>

            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar por TI-000001, marca, modelo, serial..."
              className="w-[260px] rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/10 sm:w-[360px]"
            />

            <button
              type="submit"
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm hover:brightness-110"
            >
              Buscar
            </button>

            {/* Limpar filtros (zera a URL) */}
            <Link
              href="/"
              className="rounded-xl border border-[var(--border)] bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
            >
              Limpar
            </Link>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Inventário de TI</h1>
              <p className="text-sm text-[var(--muted)]">
                Controle de equipamentos (PCs, notebooks, periféricos, etc.)
              </p>
            </div>

            <span className="text-sm text-[var(--muted)]">
              {assets.length} item(ns)
            </span>
          </div>
          {errorMsg && (
            <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {errorMsg}
              <div className="mt-1 text-xs text-rose-200/80">
                Dica: verifique se a API está rodando e se o Docker (Postgres)
                está ativo.
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--muted)]">
                <tr className="border-b border-[var(--border)]">
                  <th className="py-2 pr-4">Código</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Marca</th>
                  <th className="py-2 pr-4">Modelo</th>
                  <th className="py-2 pr-4">Serial</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Valor</th>
                </tr>
              </thead>

              <tbody>
                {assets.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-[var(--border)] last:border-0 hover:bg-white/5"
                  >
                    <td className="py-2 pr-4 font-medium">
                      <Link
                        href={`/assets/${a.id}`}
                        className="hover:underline underline-offset-4"
                      >
                        {a.internalCode}
                      </Link>
                    </td>

                    <td className="py-2 pr-4">{a.type}</td>
                    <td className="py-2 pr-4">{a.brand}</td>
                    <td className="py-2 pr-4">{a.model ?? "-"}</td>
                    <td className="py-2 pr-4">{a.serialNumber ?? "-"}</td>
                    <td className="py-2 pr-4">
                      <span className={statusBadge(a.status)}>{a.status}</span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {moneyBRL(a.valueCents)}
                    </td>
                  </tr>
                ))}

                {assets.length === 0 && (
                  <tr>
                    <td
                      className="py-10 text-center text-[var(--muted)]"
                      colSpan={7}
                    >
                      Nenhum item encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
