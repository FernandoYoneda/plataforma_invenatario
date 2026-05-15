"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuditLogs } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { AuditLog } from "@/lib/types";
import AppShell from "./AppShell";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    ASSET_CREATED: "Asset criado",
    ASSET_UPDATED: "Asset atualizado",
    ASSIGNMENT_CREATED: "Assignment criado",
    ASSIGNMENT_RETURNED: "Assignment devolvido",
    EMPLOYEE_CREATED: "Funcionario criado",
  };

  return labels[action] ?? action;
}

function entityLabel(log: AuditLog) {
  return `${log.entityType} ${log.entityId.slice(0, 8)}`;
}

export default function AuditView() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function handleAuthError(err: unknown) {
    if (
      err instanceof Error &&
      "status" in err &&
      typeof err.status === "number" &&
      err.status === 401
    ) {
      clearAuthToken();
      setRedirecting(true);
      router.replace("/login");
      return true;
    }

    return false;
  }

  useEffect(() => {
    async function load() {
      const token = getAuthToken();

      if (!token) {
        setRedirecting(true);
        setLoading(false);
        router.replace("/login");
        return;
      }

      try {
        const data = await getAuditLogs(token);
        setLogs(data);
        setError(null);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar a auditoria.";

        handleAuthError(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  const sortedLogs = useMemo(
    () =>
      [...logs].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [logs],
  );

  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / pageSize));
  const pageStartIndex = (currentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, sortedLogs.length);
  const paginatedLogs = sortedLogs.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <AppShell
      current="audit"
      title="Auditoria"
      subtitle="Timeline centralizada das principais acoes executadas no inventario."
      contentSize="standard"
    >
      <section className="overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
        <div className="flex flex-col gap-3 border-b px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
          <div className="status-pill">
            {redirecting
              ? "Redirecionando..."
              : loading
                ? "Carregando..."
                : `${logs.length} registro(s)`}
          </div>

          <label className="flex items-center gap-2 text-sm [color:var(--text-secondary)]">
            <span>Itens por pagina</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              disabled={loading || Boolean(error) || redirecting}
              className="brand-input w-auto min-w-24 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {redirecting ? (
          <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
            Redirecionando para o login...
          </div>
        ) : error ? (
          <div className="status-banner-error m-6 rounded-[22px] px-4 py-4 text-sm">
            {error}
          </div>
        ) : loading ? (
          <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
            Carregando auditoria...
          </div>
        ) : sortedLogs.length === 0 ? (
          <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
            Nenhum evento de auditoria registrado.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table data-table-compact">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Acao</th>
                    <th>Entidade</th>
                    <th>Descricao</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="cell-strong">{actionLabel(log.action)}</td>
                      <td>{entityLabel(log)}</td>
                      <td>{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t px-6 py-5 [border-color:var(--border-soft)] lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm [color:var(--text-secondary)]">
                Mostrando {pageStartIndex + 1}-{pageEndIndex} de{" "}
                {sortedLogs.length} registro(s)
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((current) => Math.max(current - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="btn-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>

                <span className="status-pill">
                  Pagina {currentPage} de {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((current) =>
                      Math.min(current + 1, totalPages),
                    )
                  }
                  disabled={currentPage === totalPages}
                  className="btn-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Proxima
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
