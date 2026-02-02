import Link from "next/link";
import EditAssetModal from "../../../components/EditAssetModal";
import DeleteAssetButton from "../../../components/DeleteAssetButton";
import type { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";

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

async function fetchAsset(id: string): Promise<Asset> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
  const res = await fetch(`${base}/assets/${id}`, { cache: "no-store" });

  if (!res.ok) {
    // tenta ler mensagem do backend (JSON)
    let msg = `Falha ao buscar ativo (HTTP ${res.status})`;
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
    throw new Error(msg);
  }

  return res.json();
}

export default async function AssetDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let result: { ok: true } | { ok: false; error: string };
  let asset: Asset | null = null;

  try {
    asset = await fetchAsset(id);
    result = { ok: true };
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : "Erro desconhecido ao buscar ativo.";
    result = { ok: false, error: msg };
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="rounded-xl border border-[var(--border)] bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
          >
            ← Voltar
          </Link>

          {result.ok && asset && (
            <>
              {/* ✅ agora tipa certo, sem any */}
              <EditAssetModal asset={asset} />

              <DeleteAssetButton
                id={asset.id}
                internalCode={asset.internalCode}
              />

              <div className="ml-auto text-sm text-[var(--muted)]">
                {asset.internalCode}
              </div>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-6">
        {!result.ok && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm">
            <div className="font-semibold text-rose-200">
              Não foi possível carregar o ativo
            </div>
            <div className="mt-1 text-rose-200/80">{result.error}</div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-100 hover:bg-rose-500/20"
              >
                Voltar para lista
              </Link>

              <a
                href={
                  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002") +
                  `/assets/${id}`
                }
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-[var(--border)] bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
              >
                Abrir API (/assets/{id})
              </a>
            </div>
          </div>
        )}

        {result.ok && asset && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold">
                  {asset.brand} {asset.model ?? ""}
                </h1>
                <p className="text-sm text-[var(--muted)]">
                  Tipo: <span className="text-white/90">{asset.type}</span>
                </p>
              </div>

              <span className={statusBadge(asset.status)}>{asset.status}</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)] bg-white/5 p-3">
                <div className="text-xs text-[var(--muted)]">
                  Código interno
                </div>
                <div className="mt-1 font-medium">{asset.internalCode}</div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-white/5 p-3">
                <div className="text-xs text-[var(--muted)]">Valor</div>
                <div className="mt-1 font-medium">
                  {moneyBRL(asset.valueCents)}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-white/5 p-3">
                <div className="text-xs text-[var(--muted)]">Serial</div>
                <div className="mt-1 font-medium">
                  {asset.serialNumber ?? "-"}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-white/5 p-3">
                <div className="text-xs text-[var(--muted)]">Registrado em</div>
                <div className="mt-1 font-medium">
                  {new Date(asset.registeredAt).toLocaleString("pt-BR")}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-white/5 p-3">
              <div className="text-xs text-[var(--muted)]">Observações</div>
              <div className="mt-1 text-sm">{asset.notes ?? "-"}</div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
