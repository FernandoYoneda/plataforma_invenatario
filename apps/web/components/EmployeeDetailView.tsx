"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getAssetDetails,
  getEmployeeAssignments,
  getEmployeesList,
} from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { Asset, Assignment, AuditLog, Employee } from "@/lib/types";
import AppShell from "./AppShell";
import EditEmployeeModal from "./EditEmployeeModal";
import EmployeeAssignmentsModal from "./EmployeeAssignmentsModal";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function assetTitle(assignment: Assignment) {
  const asset = assignment.asset;

  if (!asset) return "-";

  return [asset.internalCode, asset.brand, asset.model]
    .filter(Boolean)
    .join(" • ");
}

function typeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    DESKTOP: "Desktop",
    NOTEBOOK: "Notebook",
    MONITOR: "Monitor",
    MOUSE: "Mouse",
    TECLADO: "Teclado",
    OUTRO: "Outro",
  };

  if (!value) return "-";
  return labels[value] ?? value;
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    ASSIGNMENT_CREATED: "Atribuição",
    ASSIGNMENT_RETURNED: "Devolução",
    ASSET_UPDATED: "Atualização",
    EMPLOYEE_CREATED: "Cadastro",
    EMPLOYEE_INACTIVATED: "Inativação",
  };

  return labels[action] ?? action;
}

function actionTone(action: string) {
  if (/CREATED/i.test(action)) return "create";
  if (/UPDATED/i.test(action)) return "update";
  if (/RETURNED|INACTIVATED/i.test(action)) return "delete";
  return "neutral";
}

function toneClass(action: string) {
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

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

type EmployeeAuditEntry = {
  log: AuditLog;
  asset: Asset | null;
};

function assetFriendlyLabel(asset?: Asset | null) {
  if (!asset) {
    return null;
  }

  const parts = [typeLabel(asset.type), asset.brand, asset.model].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatEmployeeAuditDescription(entry: EmployeeAuditEntry) {
  const rawDescription = entry.log.description?.trim() ?? "";

  if (!entry.asset) {
    return rawDescription.replace(/^Asset\b/i, "Ativo");
  }

  const friendlyLabel = assetFriendlyLabel(entry.asset);
  const assetCode = entry.asset.internalCode;
  const normalizedDescription = rawDescription.replace(/^Asset\b/i, "Ativo");

  if (
    normalizedDescription.startsWith(`Ativo ${assetCode} —`) ||
    normalizedDescription.startsWith(`Ativo ${assetCode} -`)
  ) {
    return normalizedDescription;
  }

  const message = normalizedDescription.replace(
    new RegExp(`^Ativo\\s+${escapeRegExp(assetCode)}\\s*`, "i"),
    "",
  );

  if (friendlyLabel) {
    return `Ativo ${assetCode} — ${friendlyLabel}${message ? ` ${message}` : ""}`;
  }

  return `Ativo ${assetCode}${message ? ` — ${message}` : ""}`;
}

export default function EmployeeDetailView({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [auditEntries, setAuditEntries] = useState<EmployeeAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
      if (!employeeId.trim()) {
        setError("Funcionário inválido.");
        setLoading(false);
        return;
      }

      const token = getAuthToken();

      if (!token) {
        setRedirecting(true);
        setLoading(false);
        router.replace("/login");
        return;
      }

      setLoading(true);

      try {
        const [employeesData, employeeAssignmentsData] = await Promise.all([
          getEmployeesList(token, "all"),
          getEmployeeAssignments(employeeId, token),
        ]);

        const nextEmployee =
          employeesData.find((item) => item.id === employeeId) ?? null;

        setEmployee(nextEmployee);
        setAssignments(employeeAssignmentsData);

        if (nextEmployee?.id) {
          const assetDetailPromises = employeeAssignmentsData
            .map((assignment) => assignment.asset?.id)
            .filter((assetId): assetId is string => Boolean(assetId))
            .map((assetId) => getAssetDetails(assetId, token));

          const assetDetails = await Promise.all(assetDetailPromises);
          const relatedEntries = assetDetails.flatMap((detail) =>
            detail.auditLogs
              .filter(
                (log) =>
                  log.entityType === "Assignment" || log.entityType === "Asset",
              )
              .map((log) => ({
                log,
                asset: detail.asset ?? null,
              })),
          );

          setAuditEntries(relatedEntries);
        } else {
          setAuditEntries([]);
        }

        setError(null);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar o funcionario.";

        handleAuthError(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [employeeId, refreshKey, router]);

  const currentAssignments = useMemo(
    () => assignments.filter((item) => !item.returnedAt),
    [assignments],
  );
  const historyAssignments = useMemo(
    () => assignments.filter((item) => Boolean(item.returnedAt)),
    [assignments],
  );
  const employeeAuditLogs = useMemo(() => {
    if (!employee) {
      return [];
    }

    const nameNeedle = normalizeText(employee.name);
    const emailNeedle = normalizeText(employee.email);

    return auditEntries.filter((entry) => {
      const log = entry.log;
      const description = normalizeText(
        [log.description, log.entityType, log.user?.name, log.user?.email]
          .filter(Boolean)
          .join(" "),
      );

      return (
        description.includes(nameNeedle) ||
        description.includes(emailNeedle) ||
        (log.entityType === "Employee" && log.entityId === employee.id)
      );
    });
  }, [auditEntries, employee]);
  const lastMovement = useMemo(() => {
    const ordered = [...assignments].sort(
      (a, b) =>
        new Date(b.returnedAt ?? b.assignedAt).getTime() -
        new Date(a.returnedAt ?? a.assignedAt).getTime(),
    );

    return ordered[0] ?? null;
  }, [assignments]);

  const stats = [
    { label: "Ativos atuais", value: currentAssignments.length },
    { label: "Histórico", value: historyAssignments.length },
    {
      label: "Última movimentação",
      value: lastMovement ? formatDate(lastMovement.returnedAt ?? lastMovement.assignedAt) : "-",
    },
  ];

  return (
    <AppShell
      current="employees"
      title={employee?.name ?? "Funcionário"}
      subtitle="Visão completa do colaborador, seus ativos e o histórico de movimentações."
      contentSize="wide"
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/employees" className="btn-secondary px-4 py-2.5 text-sm">
            Voltar
          </Link>
          {employee?.id ? (
            <>
              <EditEmployeeModal
                employee={employee}
                onUpdated={(updatedEmployee) => {
                  setEmployee(updatedEmployee);
                  setRefreshKey((current) => current + 1);
                }}
              />
              <EmployeeAssignmentsModal
                employee={employee}
                onChanged={() => setRefreshKey((current) => current + 1)}
              />
            </>
          ) : null}
        </div>
      }
    >
      {redirecting ? (
        <section className="surface-card rounded-[30px] px-6 py-10 text-sm [color:var(--text-secondary)]">
          Redirecionando para o login...
        </section>
      ) : error ? (
        <section className="status-banner-error rounded-[28px] px-6 py-10 text-sm">
          {error}
        </section>
      ) : loading ? (
        <section className="surface-card rounded-[30px] px-6 py-10 text-sm [color:var(--text-secondary)]">
          Carregando funcionário...
        </section>
      ) : !employee ? (
        <section className="surface-card rounded-[30px] px-6 py-10 text-sm [color:var(--text-secondary)]">
          Funcionário não encontrado.
        </section>
      ) : (
        <div className="space-y-4">
          <section className="employee-detail-panel surface-card overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] shadow-[0_18px_50px_rgba(23,58,67,0.08)]">
            <div className="grid gap-4 border-b px-6 py-6 md:grid-cols-2 xl:grid-cols-4 [border-color:var(--border-soft)]">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] [color:var(--text-muted)]">
                  Nome
                </div>
                <div className="mt-1 text-sm font-medium [color:var(--text-primary)]">
                  {employee.name}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] [color:var(--text-muted)]">
                  Email
                </div>
                <div className="mt-1 text-sm font-medium [color:var(--text-primary)]">
                  {employee.email}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] [color:var(--text-muted)]">
                  Departamento
                </div>
                <div className="mt-1 text-sm font-medium [color:var(--text-primary)]">
                  {employee.department ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] [color:var(--text-muted)]">
                  Cargo
                </div>
                <div className="mt-1 text-sm font-medium [color:var(--text-primary)]">
                  {employee.position ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] [color:var(--text-muted)]">
                  Localização padrão
                </div>
                <div className="mt-1 text-sm font-medium [color:var(--text-primary)]">
                  {employee.location?.name ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] [color:var(--text-muted)]">
                  Criado em
                </div>
                <div className="mt-1 text-sm font-medium [color:var(--text-primary)]">
                  {formatDate(employee.createdAt)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] [color:var(--text-muted)]">
                  Status
                </div>
                <div className="mt-2">
                  <span className="status-pill">
                    {employee.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {stats.map((item) => (
              <div
                key={item.label}
                className="employee-detail-stat surface-card rounded-[26px] border px-5 py-5 shadow-[0_18px_50px_rgba(23,58,67,0.08)] [border-color:var(--border-soft)]"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.16em] [color:var(--text-muted)]">
                  {item.label}
                </div>
                <div className="mt-2 text-xl font-semibold [color:var(--text-primary)]">
                  {String(item.value)}
                </div>
              </div>
            ))}
          </section>

          <section className="employee-detail-panel surface-card overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] shadow-[0_18px_50px_rgba(23,58,67,0.08)]">
            <div className="flex flex-col gap-3 border-b px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold [color:var(--text-primary)]">
                  Ativos atuais
                </div>
                <div className="mt-1 text-xs [color:var(--text-secondary)]">
                  Ativos hoje vinculados ao colaborador.
                </div>
              </div>
              <span className="status-pill">{currentAssignments.length} ativo(s)</span>
            </div>
            {currentAssignments.length === 0 ? (
              <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
                Nenhum ativo atualmente atribuído.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table data-table-compact">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Tipo</th>
                      <th>Marca</th>
                      <th>Modelo</th>
                      <th>Atribuído em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAssignments.map((assignment) => (
                      <tr key={assignment.id}>
                        <td className="cell-strong">{assignment.asset?.internalCode ?? "-"}</td>
                        <td>{typeLabel(assignment.asset?.type)}</td>
                        <td>{assignment.asset?.brand ?? "-"}</td>
                        <td>{assignment.asset?.model ?? "-"}</td>
                        <td>{formatDate(assignment.assignedAt)}</td>
                        <td>
                          <div className="asset-actions-row justify-start">
                            <Link
                              href={`/assets/${assignment.assetId}`}
                              className="action-button"
                            >
                              Ver ativo
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="surface-card overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] shadow-[0_18px_50px_rgba(23,58,67,0.08)]">
            <div className="flex flex-col gap-3 border-b px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold [color:var(--text-primary)]">
                  Histórico de atribuições
                </div>
                <div className="mt-1 text-xs [color:var(--text-secondary)]">
                  Linha do tempo simples com as movimentações anteriores.
                </div>
              </div>
              <span className="status-pill">{historyAssignments.length} evento(s)</span>
            </div>
            {historyAssignments.length === 0 ? (
              <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
                Nenhum histórico de devolução encontrado.
              </div>
            ) : (
              <div className="space-y-3 px-6 py-6">
                {historyAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="employee-detail-timeline-item rounded-[22px] border px-4 py-4 [border-color:var(--border-soft)]"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold [color:var(--text-primary)]">
                          {assetTitle(assignment)}
                        </div>
                        <div className="mt-1 text-xs [color:var(--text-secondary)]">
                          Atribuído em {formatDate(assignment.assignedAt)} • Devolvido em{" "}
                          {formatDate(assignment.returnedAt)}
                        </div>
                      </div>
                      <span className="status-pill">Devolvido</span>
                    </div>
                    {assignment.notes ? (
                      <div className="mt-3 text-sm [color:var(--text-secondary)]">
                        {assignment.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="employee-detail-panel surface-card overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] shadow-[0_18px_50px_rgba(23,58,67,0.08)]">
            <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
              <div className="text-sm font-semibold [color:var(--text-primary)]">
                Auditoria do funcionário
              </div>
              <div className="mt-1 text-xs [color:var(--text-secondary)]">
                Eventos relacionados a este funcionário.
              </div>
            </div>
            {employeeAuditLogs.length === 0 ? (
              <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
                Nenhum evento de auditoria relacionado a este funcionário.
              </div>
            ) : (
              <div className="space-y-3 px-6 py-6">
                {employeeAuditLogs.slice(0, 12).map((entry, index) => (
                  <div
                    key={`${entry.log.id}-${index}`}
                    className="employee-detail-audit-item rounded-[22px] border px-4 py-4 [border-color:var(--border-soft)]"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass(entry.log.action)}`}
                          >
                            {actionLabel(entry.log.action)}
                          </span>
                          <span className="text-xs [color:var(--text-muted)]">
                            {formatDate(entry.log.createdAt)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm [color:var(--text-primary)]">
                          {formatEmployeeAuditDescription(entry)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
