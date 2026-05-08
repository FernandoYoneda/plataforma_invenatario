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
    <section className="mb-8 overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
      <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1f2937]">
            Assignments ativos
          </h2>
          <p className="mt-1 text-sm text-[#6b7280]">
            Controle rapido de assets atualmente atribuídos.
          </p>
        </div>
        <div className="text-sm text-[#6b7280]">
          {loading ? "Carregando..." : `${assignments.length} ativo(s)`}
        </div>
      </div>

      {error ? (
        <div className="px-6 py-8 text-sm text-rose-700">{error}</div>
      ) : loading ? (
        <div className="px-6 py-8 text-sm text-[#6b7280]">
          Buscando assignments ativos...
        </div>
      ) : assignments.length === 0 ? (
        <div className="px-6 py-8 text-sm text-[#6b7280]">
          Nenhum assignment ativo no momento.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#f9f5ef] text-[#6b7280]">
              <tr>
                <th className="px-6 py-3 font-medium">Asset</th>
                <th className="px-6 py-3 font-medium">Funcionario</th>
                <th className="px-6 py-3 font-medium">Atribuido em</th>
                <th className="px-6 py-3 font-medium">Observacoes</th>
                <th className="px-6 py-3 text-right font-medium">Acao</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="border-t border-black/5">
                  <td className="px-6 py-4 text-[#374151]">
                    <div className="font-medium text-[#111827]">
                      {assignment.asset?.internalCode ?? assignment.assetId}
                    </div>
                    <div className="mt-1 text-xs text-[#6b7280]">
                      {assignment.asset?.brand ?? "Asset"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[#374151]">
                    <div className="font-medium text-[#111827]">
                      {assignment.employee?.name ?? assignment.employeeId}
                    </div>
                    <div className="mt-1 text-xs text-[#6b7280]">
                      {assignment.employee?.email ?? "Sem email"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[#374151]">
                    {formatDate(assignment.assignedAt)}
                  </td>
                  <td className="px-6 py-4 text-[#374151]">
                    {assignment.notes ?? "-"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleReturn(assignment.id)}
                      disabled={returningId === assignment.id}
                      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                    >
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
