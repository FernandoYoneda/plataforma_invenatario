"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function DeleteAssetButton({
  id,
  internalCode,
}: {
  id: string;
  internalCode?: string;
}) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function close() {
    if (!loading) setOpen(false);
  }

  // Fecha com ESC
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading]);

  // Trava scroll enquanto o modal estiver aberto
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [open]);

  async function handleDelete() {
    if (!id) {
      toast.error(
        "ID do ativo está vazio (undefined). Verifique o prop do botão.",
      );
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/assets/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Falha ao excluir ativo.");
      }

      toast.success(`Ativo ${internalCode ?? ""} excluído com sucesso`);
      setOpen(false);

      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao excluir ativo.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!id) {
            toast.error("Esse ativo está sem id (undefined).");
            return;
          }
          setOpen(true);
        }}
        className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/15"
      >
        🗑 Excluir
      </button>

      {open && (
        <div className="fixed inset-0 z-[99999]" onClick={close}>
          {/* overlay */}
          <div className="absolute inset-0 bg-black/70" />

          {/* container */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-[var(--border)] px-4 py-3">
                <h2 className="text-base font-semibold">Confirmar exclusão</h2>
              </div>

              <div className="p-4 text-sm text-[var(--muted)]">
                Você tem certeza que deseja excluir o ativo{" "}
                <span className="text-white/90">{internalCode ?? id}</span>?
                <div className="mt-2 text-xs text-rose-200/80">
                  Essa ação não pode ser desfeita.
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm hover:brightness-110 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-2 text-sm text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                >
                  {loading ? "Excluindo..." : "Sim, excluir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
