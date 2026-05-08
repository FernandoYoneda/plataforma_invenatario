"use client";

import { useState } from "react";
import { toast } from "sonner";
import { returnAssignment } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { Assignment } from "@/lib/types";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function ReturnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 7H5v4" />
      <path d="M5 11a7 7 0 1 0 2-4.95L5 7" />
    </svg>
  );
}

export default function ActiveAssignmentsPanel({
  assignments,
  loading,
  error,
  onReturned,
}: {
  assignments: Assignment[];
  loading: boolean;
  error: string | null;
  onReturned: (assignmentId: string) => void;
}) {
  const [returningId, setReturningId] = useState<string | null>(null);

  async function handleReturn(assignmentId: string) {
    const token = getAuthToken();

    if (!token) {
      toast.error("Sessao expirada. Faca login novamente.");
      return;
    }

    setReturningId(assignmentId);

    try {
      await returnAssignment(assignmentId, {}, token);
      toast.success("Asset devolvido com sucesso.");
      onReturned(assignmentId);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nao foi possivel devolver o asset.";
      toast.error(message);
    } finally {
      setReturningId(null);
    }
  }

  return (
    <section className="mb-8 overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
      <div className="flex flex-col gap-3 border-b px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold [color:var(--text-primary)]">
            Assignments ativos
          </h2>
          <p className="mt-1 text-sm [color:var(--text-secondary)]">
            Controle rapido dos ativos atualmente vinculados a funcionarios.
          </p>
        </div>
        <div className="status-pill">
          {loading ? "Carregando..." : `${assignments.length} ativo(s)`}
        </div>
      </div>

      {error ? (
        <div className="status-banner-error m-6 rounded-[22px] px-4 py-4 text-sm">
          {error}
        </div>
      ) : loading ? (
        <div className="px-6 py-8 text-sm [color:var(--text-secondary)]">
          Buscando assignments ativos...
        </div>
      ) : assignments.length === 0 ? (
        <div className="px-6 py-8 text-sm [color:var(--text-secondary)]">
          Nenhum assignment ativo no momento.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table data-table-compact">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Funcionario</th>
                <th>Atribuido em</th>
                <th>Observacoes</th>
                <th className="text-right">Acao</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>
                    <div className="cell-strong">
                      {assignment.asset?.internalCode ?? assignment.assetId}
                    </div>
                    <div className="mt-1 text-xs [color:var(--text-muted)]">
                      {assignment.asset?.brand ?? "Asset"}
                    </div>
                  </td>
                  <td>
                    <div className="cell-strong">
                      {assignment.employee?.name ?? assignment.employeeId}
                    </div>
                    <div className="mt-1 text-xs [color:var(--text-muted)]">
                      {assignment.employee?.email ?? "Sem email"}
                    </div>
                  </td>
                  <td>{formatDate(assignment.assignedAt)}</td>
                  <td>{assignment.notes ?? "-"}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => handleReturn(assignment.id)}
                      disabled={returningId === assignment.id}
                      className="action-button border-rose-200 bg-rose-50/90 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                    >
                      <ReturnIcon />
                      {returningId === assignment.id ? "Devolvendo..." : "Devolver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
