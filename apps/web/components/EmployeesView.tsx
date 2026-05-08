"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getEmployees } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { Employee } from "@/lib/types";
import AppShell from "./AppShell";
import NewEmployeeModal from "./NewEmployeeModal";

export default function EmployeesView() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

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
        const data = await getEmployees(token);
        setEmployees(data);
        setError(null);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar os funcionarios.";

        handleAuthError(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  return (
    <AppShell
      current="employees"
      title="Funcionarios"
      subtitle="Cadastro e consulta da base de colaboradores usada nas atribuicoes de assets."
      actions={
        <NewEmployeeModal
          onCreated={(employee) => {
            setEmployees((current) =>
              [...current, employee].sort((a, b) =>
                a.name.localeCompare(b.name, "pt-BR"),
              ),
            );
            setError(null);
          }}
        />
      }
    >
          <section className="overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
            <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
              <div className="status-pill">
                {redirecting
                  ? "Redirecionando..."
                  : loading
                    ? "Carregando..."
                    : `${employees.length} funcionario(s)`}
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
                Buscando funcionarios...
              </div>
            ) : employees.length === 0 ? (
              <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
                Nenhum funcionario cadastrado ainda. Use o botao "Novo
                Funcionario" para criar o primeiro.
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
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr key={employee.id}>
                        <td className="cell-strong">{employee.name}</td>
                        <td>{employee.email}</td>
                        <td>{employee.department ?? "-"}</td>
                        <td>{employee.position ?? "-"}</td>
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
