import HeaderActions from "../components/HeaderActions";
import Link from "next/link";
import type { Asset, AssetStatus, AssetType } from "@/lib/types";

export const dynamic = "force-dynamic";

type FetchResult = { ok: true; data: Asset[] } | { ok: false; error: string };

async function fetchAssets(filters: {
  q?: string;
  type?: AssetType;
  status?: AssetStatus;
}): Promise<FetchResult> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
  const url = new URL("/assets", base);

  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.type) url.searchParams.set("type", filters.type);
  if (filters.status) url.searchParams.set("status", filters.status);

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      let msg = `Falha ao buscar ativos (HTTP ${res.status})`;

      try {
        const maybe = await res.json();
        if (maybe?.message) {
          msg = Array.isArray(maybe.message)
            ? maybe.message.join(", ")
            : String(maybe.message);
        }
      } catch {
        // ignora se não for JSON
      }

      return { ok: false, error: msg };
    }

    const data = (await res.json()) as Asset[];
    return { ok: true, data };
  } catch (e: unknown) {
    const msg =
      e instanceof Error
        ? `Erro de rede ao buscar ativos: ${e.message}`
        : "Erro de rede ao buscar ativos.";
    return { ok: false, error: msg };
  }
}

function moneyBRL(valueCents?: number | null) {
  if (valueCents == null) return "-";
  return (valueCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusBadge(status: AssetStatus) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs";

  const map: Record<AssetStatus, string> = {
    EM_USO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    ESTOQUE: "border-sky-500/30 bg-sky-500/10 text-sky-200",
    MANUTENCAO: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    BAIXADO: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  };

  return `${base} ${map[status] ?? "border-white/10 bg-white/5 text-white/80"}`;
}

function labelType(t: AssetType) {
  const map: Record<AssetType, string> = {
    DESKTOP: "Desktop",
    NOTEBOOK: "Notebook",
    MONITOR: "Monitor",
    MOUSE: "Mouse",
    TECLADO: "Teclado",
    OUTRO: "Outro",
  };
  return map[t] ?? t;
}

function labelStatus(s: AssetStatus) {
  const map: Record<AssetStatus, string> = {
    EM_USO: "Em uso",
    ESTOQUE: "Estoque",
    MANUTENCAO: "Manutenção",
    BAIXADO: "Baixado",
  };
  return map[s] ?? s;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: AssetType; status?: AssetStatus }>;
}) {
  const sp = await searchParams;

  const q = sp?.q ?? "";
  const type = sp?.type ?? "";
  const status = sp?.status ?? "";
  const hasFilters = Boolean(q || type || status);

  function buildHref(next: {
    q?: string;
    type?: AssetType;
    status?: AssetStatus;
  }) {
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.type) params.set("type", next.type);
    if (next.status) params.set("status", next.status);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  const result = await fetchAssets({
    q: q || undefined,
    type: (type || undefined) as AssetType | undefined,
    status: (status || undefined) as AssetStatus | undefined,
  });

  const assets = result.ok ? result.data : [];

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

          <form className="ml-auto flex flex-wrap items-center gap-2">
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
              {result.ok ? `${assets.length} item(ns)` : "—"}
            </span>
          </div>

          {result.ok && hasFilters && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/5 p-3 text-sm">
              <span className="text-[var(--muted)]">Filtros:</span>

              {type && (
                <Link
                  href={buildHref({
                    q: q || undefined,
                    type: undefined,
                    status: (status || undefined) as AssetStatus | undefined,
                  })}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 hover:brightness-110"
                  title="Remover filtro de tipo"
                >
                  Tipo: {labelType(type as AssetType)} ✕
                </Link>
              )}

              {status && (
                <Link
                  href={buildHref({
                    q: q || undefined,
                    type: (type || undefined) as AssetType | undefined,
                    status: undefined,
                  })}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 hover:brightness-110"
                  title="Remover filtro de status"
                >
                  Status: {labelStatus(status as AssetStatus)} ✕
                </Link>
              )}

              {q && (
                <Link
                  href={buildHref({
                    q: undefined,
                    type: (type || undefined) as AssetType | undefined,
                    status: (status || undefined) as AssetStatus | undefined,
                  })}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 hover:brightness-110"
                  title="Remover busca"
                >
                  Busca: “{q}” ✕
                </Link>
              )}

              <span className="ml-auto" />

              <Link
                href="/"
                className="rounded-xl border border-[var(--border)] bg-white/10 px-3 py-1.5 hover:bg-white/15"
                title="Limpar tudo"
              >
                Limpar tudo
              </Link>
            </div>
          )}

          {!result.ok && (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
              <div className="font-semibold text-rose-200">
                Não foi possível carregar a lista
              </div>
              <div className="mt-1 text-rose-200/80">{result.error}</div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-100 hover:bg-rose-500/20"
                >
                  Tentar novamente
                </Link>

                <a
                  href={
                    (process.env.NEXT_PUBLIC_API_URL ??
                      "http://localhost:3002") + "/assets"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-[var(--border)] bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                >
                  Abrir API (/assets)
                </a>
              </div>
            </div>
          )}

          {result.ok && (
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
                        <span className={statusBadge(a.status)}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        {moneyBRL(a.valueCents)}
                      </td>
                    </tr>
                  ))}

                  {assets.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10">
                        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-white/5 p-6 text-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card)] text-2xl shadow-sm">
                            {hasFilters ? "🔍" : "📦"}
                          </div>

                          <div>
                            <div className="text-base font-semibold">
                              {hasFilters
                                ? "Nenhum resultado encontrado"
                                : "Nenhum ativo cadastrado"}
                            </div>

                            <div className="mt-1 text-sm text-[var(--muted)]">
                              {hasFilters
                                ? "Tente remover os filtros ou alterar a busca."
                                : "Cadastre o primeiro ativo para começar."}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap justify-center gap-2">
                            <Link
                              href="/"
                              className="rounded-xl border border-[var(--border)] bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
                            >
                              Limpar filtros
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
