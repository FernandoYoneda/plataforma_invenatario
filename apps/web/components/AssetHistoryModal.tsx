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

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
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
      <div className="absolute inset-0 bg-[rgba(23,58,67,0.66)] backdrop-blur-[3px]" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="glass-panel w-full max-w-3xl overflow-hidden rounded-[30px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-6 py-5 [border-color:var(--border-soft)]">
            <div>
              <p className="eyebrow">Historico</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                {asset.internalCode}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary px-3 py-2 text-sm"
            >
              Fechar
            </button>
          </div>

          <div className="max-h-[70vh] overflow-auto px-6 py-5">
            {error ? (
              <div className="status-banner-error rounded-[22px] px-4 py-3 text-sm">
                {error}
              </div>
            ) : loading ? (
              <div className="text-sm [color:var(--text-secondary)]">
                Carregando historico...
              </div>
            ) : history.length === 0 ? (
              <div className="surface-soft rounded-[24px] px-4 py-4 text-sm [color:var(--text-secondary)]">
                Este asset ainda nao possui atribuicoes registradas.
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="surface-soft rounded-[24px] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium [color:var(--text-primary)]">
                          {assignment.employee?.name ??
                            assignment.employeeId ??
                            "Funcionario removido"}
                        </div>
                        <div className="mt-1 text-sm [color:var(--text-secondary)]">
                          {assignment.employee?.email ?? "Funcionario removido"}
                        </div>
                      </div>
                      <div className="status-pill">
                        {assignment.returnedAt ? "Devolvido" : "Ativo"}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm [color:var(--text-secondary)] sm:grid-cols-2">
                      <div>Atribuido em: {formatDate(assignment.assignedAt)}</div>
                      <div>Devolvido em: {formatDate(assignment.returnedAt)}</div>
                    </div>

                    <div className="mt-3 text-sm [color:var(--text-secondary)]">
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
        className="action-button"
      >
        <HistoryIcon />
        Historico
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
