"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveAssignments, getAssets } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { Assignment, Asset } from "@/lib/types";
import AppShell from "./AppShell";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

export default function DashboardView() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
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
        const [assetsData, assignmentsData] = await Promise.all([
          getAssets(token),
          getActiveAssignments(token),
        ]);

        setAssets(assetsData);
        setAssignments(assignmentsData);
        setError(null);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar o dashboard.";

        handleAuthError(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  const metrics = useMemo(() => {
    const assignedAssetIds = new Set(assignments.map((item) => item.assetId));

    return {
      totalAssets: assets.length,
      assetsInStock: assets.filter((item) => item.status === "ESTOQUE").length,
      assetsAssigned: assignedAssetIds.size,
      assetsInMaintenance: assets.filter((item) => item.status === "MANUTENCAO")
        .length,
      activeAssignments: assignments.length,
    };
  }, [assets, assignments]);

  const cards = [
    {
      label: "Total de assets",
      value: metrics.totalAssets,
      accent: "rgba(44,100,112,0.16)",
    },
    {
      label: "Assets em estoque",
      value: metrics.assetsInStock,
      accent: "rgba(215,121,103,0.16)",
    },
    {
      label: "Assets atribuidos",
      value: metrics.assetsAssigned,
      accent: "rgba(23,58,67,0.12)",
    },
    {
      label: "Assets em manutencao",
      value: metrics.assetsInMaintenance,
      accent: "rgba(215,121,103,0.12)",
    },
    {
      label: "Assignments ativos",
      value: metrics.activeAssignments,
      accent: "rgba(44,100,112,0.1)",
    },
  ];

  return (
    <AppShell
      current="dashboard"
      title="Dashboard"
      subtitle="Visao consolidada do inventario, com leitura rapida de ativos, manutencoes e atribuicoes em andamento."
    >
          {redirecting ? (
            <section className="surface-card rounded-[30px] px-6 py-10 text-sm [color:var(--text-secondary)]">
              Redirecionando para o login...
            </section>
          ) : error ? (
            <section className="status-banner-error rounded-[28px] px-6 py-10 text-sm">
              {error}
            </section>
          ) : (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {cards.map((card) => (
                  <article
                    key={card.label}
                    className="stat-card"
                  >
                    <div
                      className="mb-5 h-2.5 w-16 rounded-full"
                      style={{ backgroundColor: card.accent }}
                    />
                    <div className="text-sm [color:var(--text-secondary)]">
                      {card.label}
                    </div>
                    <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] [color:var(--text-primary)]">
                      {loading ? "..." : card.value}
                    </div>
                  </article>
                ))}
              </section>

              <section className="overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
                <div className="flex flex-col gap-2 border-b px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold [color:var(--text-primary)]">
                      Assignments ativos
                    </h2>
                    <p className="mt-1 text-sm [color:var(--text-secondary)]">
                      Ultimos registros disponiveis no endpoint atual.
                    </p>
                  </div>
                  <div className="status-pill">
                    {loading ? "Carregando..." : `${assignments.length} ativo(s)`}
                  </div>
                </div>

                {loading ? (
                  <div className="px-6 py-8 text-sm [color:var(--text-secondary)]">
                    Carregando dashboard...
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="px-6 py-8 text-sm [color:var(--text-secondary)]">
                    Nenhum assignment ativo encontrado.
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {!loading && assets.length === 0 && assignments.length === 0 && (
                <section className="surface-card rounded-[28px] px-6 py-8 text-sm [color:var(--text-secondary)]">
                  O inventario ainda nao possui assets nem assignments. Cadastre o
                  primeiro asset para iniciar o acompanhamento.
                </section>
              )}
            </>
          )}
    </AppShell>
  );
}
