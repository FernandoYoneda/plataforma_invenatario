"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getEmployeesList } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { Employee } from "@/lib/types";
import AppShell from "./AppShell";
import ImportEmployeesModal from "./ImportEmployeesModal";
import DeleteEmployeeButton from "./DeleteEmployeeButton";
import EmployeeAssignmentsModal from "./EmployeeAssignmentsModal";
import NewEmployeeModal from "./NewEmployeeModal";

type EmployeeFilter = "active" | "inactive" | "all";

export default function EmployeesView() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filter, setFilter] = useState<EmployeeFilter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  function appendImportedEmployees(importedEmployees: Employee[]) {
    if (filter === "inactive") {
      return;
    }

    setEmployees((current) =>
      [...current, ...importedEmployees].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      ),
    );
    setError(null);
  }

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

      setLoading(true);

      try {
        const data = await getEmployeesList(token, filter);
        setEmployees(data);
        setError(null);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Não foi possível carregar os funcionários.";

        handleAuthError(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [filter, router]);

  return (
    <AppShell
      current="employees"
      title="Funcionários"
      subtitle="Cadastro e consulta da base de colaboradores usada nas atribuições de ativos."
      contentSize="compact"
      actions={
        <div className="flex flex-wrap gap-3">
          <ImportEmployeesModal
            employees={employees}
            onImported={appendImportedEmployees}
          />
          <NewEmployeeModal
            onCreated={(employee) => appendImportedEmployees([employee])}
          />
        </div>
      }
    >
      <section className="overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5 [border-color:var(--border-soft)]">
          <div className="status-pill">
            {redirecting
              ? "Redirecionando..."
              : loading
                ? "Carregando..."
                : `${employees.length} funcionário(s)`}
          </div>

          <div className="flex flex-wrap gap-2">
            {[
                { key: "active", label: "Ativos" },
                { key: "inactive", label: "Inativos" },
                { key: "all", label: "Todos" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key as EmployeeFilter)}
                className={
                  filter === item.key
                    ? "btn-secondary [border-color:var(--brand-teal-700)] bg-[rgba(31,75,85,0.08)] px-3 py-2 text-sm"
                    : "btn-secondary px-3 py-2 text-sm"
                }
              >
                {item.label}
              </button>
            ))}
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
            Buscando funcionários...
          </div>
        ) : employees.length === 0 ? (
          <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
            {filter === "inactive"
              ? "Nenhum funcionário inativo encontrado."
              : filter === "all"
                ? "Nenhum funcionário cadastrado ainda."
                : "Nenhum funcionário ativo cadastrado ainda."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table data-table-compact">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Departamento</th>
                  <th>Cargo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="cell-strong">{employee.name}</td>
                    <td>{employee.email}</td>
                    <td>{employee.department ?? "-"}</td>
                    <td>{employee.position ?? "-"}</td>
                    <td>
                      <span className="status-pill">
                        {employee.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      {employee.isActive ? (
                        <div className="asset-actions-row justify-start">
                          <EmployeeAssignmentsModal employee={employee} />
                          <DeleteEmployeeButton
                            employee={employee}
                            onDeleted={(employeeId) => {
                              setEmployees((current) =>
                                filter === "all"
                                  ? current.map((item) =>
                                      item.id === employeeId
                                        ? { ...item, isActive: false }
                                        : item,
                                    )
                                  : current.filter((item) => item.id !== employeeId),
                              );
                              setError(null);
                            }}
                          />
                        </div>
                      ) : (
                        <span className="text-sm [color:var(--text-muted)]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
