"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuditLogs } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { AuditLog } from "@/lib/types";
import AppShell from "./AppShell";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type ActionTone = "create" | "update" | "delete" | "neutral";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatDateTime(value: string) {
  const date = new Date(value);

  return {
    date: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date),
  };
}

function actionTone(action: string): ActionTone {
  if (/CREATED|IMPORTED|UPLOADED/i.test(action)) return "create";
  if (/UPDATED/i.test(action)) return "update";
  if (/DELETED|INACTIVATED|RETURNED/i.test(action)) return "delete";
  return "neutral";
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    ASSET_CREATED: "Ativo criado",
    ASSET_UPDATED: "Ativo atualizado",
    ASSET_IMPORTED: "Ativos importados",
    ASSIGNMENT_CREATED: "Atribuição criada",
    ASSIGNMENT_RETURNED: "Atribuição devolvida",
    EMPLOYEE_CREATED: "Funcionário criado",
    EMPLOYEE_INACTIVATED: "Funcionário inativado",
    ATTACHMENT_UPLOADED: "Anexo enviado",
    IMPORT_COMPLETED: "Importação concluída",
    ASSET_DELETED: "Ativo excluído",
  };

  if (labels[action]) {
    return labels[action];
  }

  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function entityLabel(entityType: string) {
  const labels: Record<string, string> = {
    Asset: "Ativo",
    Assignment: "Atribuição",
    Employee: "Funcionário",
    Category: "Categoria",
    Location: "Localização",
  };

  return labels[entityType] ?? entityType;
}

function entityLabelWithId(log: AuditLog) {
  return `${entityLabel(log.entityType)} ${log.entityId.slice(0, 8)}`;
}

function actionBadgeClass(action: string) {
  const tone = actionTone(action);

  if (tone === "create") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (tone === "update") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (tone === "delete") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function csvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function prettifyDescription(rawDescription: string) {
  const text = rawDescription.trim();
  const replacements: Array<[RegExp, string]> = [
    [/\bAsset\b/gi, "Ativo"],
    [/\basset\b/gi, "ativo"],
    [/\bAssignment\b/gi, "Atribuição"],
    [/\bassignment\b/gi, "atribuição"],
    [/\bEmployee\b/gi, "Funcionário"],
    [/\bemployee\b/gi, "funcionário"],
    [/\bCategory\b/gi, "Categoria"],
    [/\bcategory\b/gi, "categoria"],
    [/\bLocation\b/gi, "Localização"],
    [/\blocation\b/gi, "localização"],
    [/\bupdated\b/gi, "atualizado"],
    [/\bcreated\b/gi, "criado"],
    [/\bdeleted\b/gi, "excluído"],
    [/\breturned\b/gi, "devolvido"],
    [/\bassigned to\b/gi, "atribuído para"],
    [/\buploaded\b/gi, "enviado"],
    [/\bcompleted\b/gi, "concluída"],
    [/\bimported\b/gi, "importado"],
  ];

  let normalized = text;
  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized
    .replace(/\bFuncionario\b/g, "Funcionário")
    .replace(/\bfuncionario\b/g, "funcionário")
    .replace(/\bAtribuicao\b/g, "Atribuição");

  const assetUpdated = /^Ativo\s+(.+?)\s+atualizado$/i.exec(normalized);
  if (assetUpdated) {
    return `Ativo ${assetUpdated[1]} atualizado`;
  }

  const assetDeleted = /^Ativo\s+(.+?)\s+excluído$/i.exec(normalized);
  if (assetDeleted) {
    return `Ativo ${assetDeleted[1]} excluído`;
  }

  const assigned = /^(.+?)\s+atribuído\s+para\s+(.+)$/i.exec(normalized);
  if (assigned) {
    return `${assigned[1]} atribuído para ${assigned[2]}`;
  }

  const returned = /^(.+?)\s+devolvido\s+por\s+(.+)$/i.exec(normalized);
  if (returned) {
    return `${returned[1]} devolvido por ${returned[2]}`;
  }

  return normalized;
}

function describeLog(log: AuditLog) {
  const description = prettifyDescription(log.description);

  if (log.entityType === "Asset") {
    if (/atualizado$/i.test(description) || /criado$/i.test(description)) {
      return description;
    }
  }

  return description;
}

function buildCsv(rows: AuditLog[]) {
  const header = [
    "data",
    "hora",
    "acao",
    "entidade",
    "id_entidade",
    "descricao",
    "usuario",
    "email_usuario",
  ];

  const lines = rows.map((log) => {
    const dateTime = formatDateTime(log.createdAt);

    return [
      dateTime.date,
      dateTime.time,
      actionLabel(log.action),
      entityLabel(log.entityType),
      log.entityId,
      describeLog(log),
      log.user?.name ?? "",
      log.user?.email ?? "",
    ]
      .map(csvValue)
      .join(",");
  });

  return [header.map(csvValue).join(","), ...lines].join("\r\n");
}

function searchText(log: AuditLog) {
  return [
    log.description,
    describeLog(log),
    log.entityType,
    entityLabel(log.entityType),
    log.action,
    actionLabel(log.action),
    log.entityId,
    log.user?.name ?? "",
    log.user?.email ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function AuditView() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

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
            : "Não foi possível carregar a auditoria.";

        handleAuthError(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  const actionOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action))).sort((a, b) =>
      actionLabel(a).localeCompare(actionLabel(b), "pt-BR"),
    );
  }, [logs]);

  const entityOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.entityType))).sort((a, b) =>
      entityLabel(a).localeCompare(entityLabel(b), "pt-BR"),
    );
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const normalizedSearch = normalizeText(search.trim());

    return logs
      .filter((log) => {
        const matchesSearch =
          !normalizedSearch ||
          normalizeText(searchText(log)).includes(normalizedSearch);
        const matchesAction = !actionFilter || log.action === actionFilter;
        const matchesEntity = !entityFilter || log.entityType === entityFilter;

        const createdAt = new Date(log.createdAt).getTime();
        const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
        const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

        return (
          matchesSearch &&
          matchesAction &&
          matchesEntity &&
          (fromTime == null || createdAt >= fromTime) &&
          (toTime == null || createdAt <= toTime)
        );
      })
      .sort((a, b) => {
        const delta =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sortDirection === "desc" ? -delta : delta;
      });
  }, [actionFilter, dateFrom, dateTo, entityFilter, logs, search, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const pageStartIndex = filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredLogs.length);
  const paginatedLogs = filteredLogs.slice(pageStartIndex, pageEndIndex);

  const hasFilters = Boolean(
    search.trim() || actionFilter || entityFilter || dateFrom || dateTo,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [actionFilter, dateFrom, dateTo, entityFilter, pageSize, search, sortDirection]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function clearFilters() {
    setSearch("");
    setActionFilter("");
    setEntityFilter("");
    setDateFrom("");
    setDateTo("");
    setSortDirection("desc");
    setCurrentPage(1);
  }

  function exportCsv() {
    const blob = new Blob([`\ufeff${buildCsv(filteredLogs)}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "auditoria-filtrada.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      current="audit"
      title="Auditoria"
      subtitle="Consulta, investigação e exportação dos eventos do sistema."
      contentSize="standard"
    >
      <section className="overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
        <div className="flex flex-col gap-3 border-b px-6 py-5 [border-color:var(--border-soft)] xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="status-pill">
              {redirecting
                ? "Redirecionando..."
                : loading
                  ? "Carregando..."
                  : `${logs.length} registro(s)`}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="status-pill">{filteredLogs.length} filtrado(s)</div>
              <div className="status-pill">
                Ordenado por data {sortDirection === "desc" ? "descendente" : "ascendente"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setSortDirection((current) => (current === "desc" ? "asc" : "desc"))
              }
              disabled={loading || Boolean(error) || redirecting}
              className="btn-secondary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              {sortDirection === "desc" ? "Data ↓" : "Data ↑"}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || Boolean(error) || redirecting || filteredLogs.length === 0}
              className="btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <label className="block text-sm">
              <span className="font-medium [color:var(--text-primary)]">Buscar</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="brand-input mt-1.5"
                placeholder="Descrição, entidade, ação ou usuário"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium [color:var(--text-primary)]">Tipo de ação</span>
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className="brand-input mt-1.5"
              >
                <option value="">Todas</option>
                {actionOptions.map((action) => (
                  <option key={action} value={action}>
                    {actionLabel(action)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-medium [color:var(--text-primary)]">Entidade</span>
              <select
                value={entityFilter}
                onChange={(event) => setEntityFilter(event.target.value)}
                className="brand-input mt-1.5"
              >
                <option value="">Todas</option>
                {entityOptions.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {entityLabel(entityType)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-medium [color:var(--text-primary)]">De</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="brand-input mt-1.5"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium [color:var(--text-primary)]">Até</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="brand-input mt-1.5"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="btn-secondary px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Limpar filtros
              </button>
            </div>
          </div>
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
        ) : logs.length === 0 ? (
          <div className="px-6 py-12">
            <div className="rounded-[24px] border border-dashed px-5 py-6 text-sm [border-color:var(--border-soft)] [color:var(--text-secondary)]">
              Nenhum evento de auditoria registrado ainda.
            </div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="px-6 py-12">
            <div className="rounded-[24px] border border-dashed px-5 py-6 text-sm [border-color:var(--border-soft)] [color:var(--text-secondary)]">
              Nenhum log encontrado com os filtros aplicados.
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table data-table-compact">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Ação</th>
                    <th>Entidade</th>
                    <th>Descrição</th>
                    <th>Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log) => {
                    const dateTime = formatDateTime(log.createdAt);

                    return (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="cell-strong">{dateTime.date}</span>
                            <span className="text-xs text-[var(--text-secondary)]">
                              {dateTime.time}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${actionBadgeClass(log.action)}`}
                          >
                            {actionLabel(log.action)}
                          </span>
                        </td>
                        <td>{entityLabelWithId(log)}</td>
                        <td>{describeLog(log)}</td>
                        <td>
                          {log.user ? `${log.user.name} (${log.user.email})` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t px-6 py-5 [border-color:var(--border-soft)] lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm [color:var(--text-secondary)]">
                Mostrando {pageStartIndex + 1}-{pageEndIndex} de {filteredLogs.length} registro(s)
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <label className="flex items-center gap-2 text-sm [color:var(--text-secondary)]">
                  <span>Itens por página</span>
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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((current) => Math.max(current - 1, 1))
                    }
                    disabled={currentPage === 1 || filteredLogs.length === 0}
                    className="btn-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>

                  <span className="status-pill">
                    Página {currentPage} de {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((current) => Math.min(current + 1, totalPages))
                    }
                    disabled={currentPage === totalPages || filteredLogs.length === 0}
                    className="btn-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
