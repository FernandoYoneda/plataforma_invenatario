"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { getEmployeeAssignments } from "@/lib/api";
import type { Assignment, Employee } from "@/lib/types";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

export default function EmployeeAssignmentsModal({
  employee,
}: {
  employee: Employee;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  function handleAuthError(err: unknown) {
    if (
      err instanceof Error &&
      "status" in err &&
      typeof err.status === "number" &&
      err.status === 401
    ) {
      clearAuthToken();
      router.replace("/login");
      return true;
    }

    return false;
  }

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

    async function loadAssignments() {
      const token = getAuthToken();

      if (!token) {
        if (!active) return;
        clearAuthToken();
        router.replace("/login");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getEmployeeAssignments(employee.id, token);

        if (!active) return;

        setAssignments(data);
      } catch (err: unknown) {
        if (!active) return;

        if (handleAuthError(err)) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar os ativos do funcionario.";

        setError(message);
        setAssignments([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAssignments();

    return () => {
      active = false;
    };
  }, [employee.id, open, router]);

  const activeAssignments = assignments.filter((assignment) => !assignment.returnedAt);
  const historyAssignments = assignments.filter((assignment) => assignment.returnedAt);

  const modal = (
    <div className="fixed inset-0 z-[99999]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-[rgba(23,58,67,0.66)] backdrop-blur-[3px]" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="glass-panel w-full max-w-4xl overflow-hidden rounded-[30px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-6 py-5 [border-color:var(--border-soft)]">
            <div>
              <p className="eyebrow">Ativos</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                {employee.name}
              </h2>
              <p className="mt-1 text-sm [color:var(--text-secondary)]">
                {employee.email}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary px-3 py-2 text-sm"
            >
              Fechar
            </button>
          </div>

          <div className="max-h-[72vh] overflow-auto px-6 py-5">
            {error ? (
              <div className="status-banner-error rounded-[22px] px-4 py-3 text-sm">
                {error}
              </div>
            ) : loading ? (
              <div className="text-sm [color:var(--text-secondary)]">
                Carregando ativos do funcionario...
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <div className="status-pill">
                    {activeAssignments.length} ativo(s)
                  </div>
                  <div className="status-pill">
                    {historyAssignments.length} no historico
                  </div>
                  <div className="status-pill">{assignments.length} total</div>
                </div>

                <section className="surface-soft rounded-[24px] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold [color:var(--text-primary)]">
                      Ativos atuais
                    </h3>
                    <span className="text-xs [color:var(--text-secondary)]">
                      Apenas atribuicoes em aberto
                    </span>
                  </div>

                  {activeAssignments.length === 0 ? (
                    <div className="text-sm [color:var(--text-secondary)]">
                      Nenhum ativo atribuido no momento.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeAssignments.map((assignment) => (
                        <article
                          key={assignment.id}
                          className="rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.76)] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-medium [color:var(--text-primary)]">
                                {assignment.asset?.internalCode ?? assignment.assetId}
                              </div>
                              <div className="mt-1 text-sm [color:var(--text-secondary)]">
                                {assignment.asset?.brand ?? "Ativo"}
                              </div>
                            </div>
                            <div className="status-pill">Ativo</div>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm [color:var(--text-secondary)] sm:grid-cols-2">
                            <div>Atribuido em: {formatDate(assignment.assignedAt)}</div>
                            <div>Devolvido em: {formatDate(assignment.returnedAt)}</div>
                          </div>

                          <div className="mt-3 text-sm [color:var(--text-secondary)]">
                            Observacoes: {assignment.notes ?? "-"}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="surface-soft rounded-[24px] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold [color:var(--text-primary)]">
                      Historico de atribuicoes
                    </h3>
                    <span className="text-xs [color:var(--text-secondary)]">
                      Atribuicoes encerradas
                    </span>
                  </div>

                  {historyAssignments.length === 0 ? (
                    <div className="text-sm [color:var(--text-secondary)]">
                      Nenhum historico encontrado para este funcionario.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historyAssignments.map((assignment) => (
                        <article
                          key={assignment.id}
                          className="rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.76)] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-medium [color:var(--text-primary)]">
                                {assignment.asset?.internalCode ?? assignment.assetId}
                              </div>
                              <div className="mt-1 text-sm [color:var(--text-secondary)]">
                                {assignment.asset?.brand ?? "Ativo"}
                              </div>
                            </div>
                            <div className="status-pill">Encerrado</div>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm [color:var(--text-secondary)] sm:grid-cols-2">
                            <div>Atribuido em: {formatDate(assignment.assignedAt)}</div>
                            <div>Devolvido em: {formatDate(assignment.returnedAt)}</div>
                          </div>

                          <div className="mt-3 text-sm [color:var(--text-secondary)]">
                            Observacoes: {assignment.notes ?? "-"}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="action-button">
        Ver ativos
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
