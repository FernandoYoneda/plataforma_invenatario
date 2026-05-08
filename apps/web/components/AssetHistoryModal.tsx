"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getAssetHistory } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { Asset, Assignment } from "@/lib/types";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

export default function AssetHistoryModal({
  asset,
  refreshKey,
}: {
  asset: Asset;
  refreshKey: number;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [history, setHistory] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let active = true;

    async function loadHistory() {
      const token = getAuthToken();

      if (!token) {
        if (!active) return;
        setError("Sessao expirada. Faca login novamente.");
        setHistory([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getAssetHistory(asset.id, token);
        if (!active) return;
        setHistory(data);
      } catch (err: unknown) {
        if (!active) return;
        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar o historico.";
        setError(message);
        setHistory([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, [asset.id, open, refreshKey]);

  const modal = (
    <div className="fixed inset-0 z-[99999]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-[#1f2937]/65 backdrop-blur-[2px]" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.22)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8c5f46]">
                Historico
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#1f2937]">
                {asset.internalCode}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-2xl border border-[#d7d4cd] px-3 py-2 text-sm text-[#6b7280] transition hover:bg-[#f9f5ef]"
            >
              Fechar
            </button>
          </div>

          <div className="max-h-[70vh] overflow-auto px-6 py-5">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : loading ? (
              <div className="text-sm text-[#6b7280]">Carregando historico...</div>
            ) : history.length === 0 ? (
              <div className="rounded-2xl border border-[#d7d4cd] bg-[#fcfaf7] px-4 py-4 text-sm text-[#6b7280]">
                Este asset ainda nao possui atribuicoes registradas.
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="rounded-2xl border border-black/10 bg-[#fcfaf7] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-[#111827]">
                          {assignment.employee?.name ?? assignment.employeeId}
                        </div>
                        <div className="mt-1 text-sm text-[#6b7280]">
                          {assignment.employee?.email ?? "Sem email"}
                        </div>
                      </div>
                      <div className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium text-[#374151]">
                        {assignment.returnedAt ? "Devolvido" : "Ativo"}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-[#374151] sm:grid-cols-2">
                      <div>Atribuido em: {formatDate(assignment.assignedAt)}</div>
                      <div>Devolvido em: {formatDate(assignment.returnedAt)}</div>
                    </div>

                    <div className="mt-3 text-sm text-[#374151]">
                      Observacoes: {assignment.notes ?? "-"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-[#d7d4cd] bg-white px-3 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#f9f5ef]"
      >
        Historico
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
