"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveAssignments, getAssets, getLocations } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { Assignment, Asset, Location } from "@/lib/types";
import AppShell from "./AppShell";

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

export default function DashboardView() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
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
        const [assetsData, assignmentsData, locationsData] = await Promise.all([
          getAssets(token),
          getActiveAssignments(token),
          getLocations(token),
        ]);

        setAssets(assetsData);
        setAssignments(assignmentsData);
        setLocations(locationsData);
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

  const locationBreakdown = useMemo(() => {
    const byId = new Map(locations.map((location) => [location.id, location]));
    const counts = new Map<string, number>();
    let withoutLocation = 0;

    for (const asset of assets) {
      const locationId = asset.locationId ?? asset.location?.id ?? "";

      if (!locationId) {
        withoutLocation += 1;
        continue;
      }

      counts.set(locationId, (counts.get(locationId) ?? 0) + 1);
    }

    const items = Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        name: byId.get(id)?.name ?? "Localização sem nome",
        count,
        percent: assets.length > 0 ? Math.round((count / assets.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));

    return {
      items,
      withoutLocation,
      totalLocationAssets: items.reduce((total, item) => total + item.count, 0),
    };
  }, [assets, locations]);

  const cards = [
    {
      label: "Total de ativos",
      value: metrics.totalAssets,
      accent: "rgba(44,100,112,0.16)",
    },
    {
      label: "Ativos em estoque",
      value: metrics.assetsInStock,
      accent: "rgba(215,121,103,0.16)",
    },
    {
      label: "Ativos atribuídos",
      value: metrics.assetsAssigned,
      accent: "rgba(23,58,67,0.12)",
    },
    {
      label: "Ativos em manutenção",
      value: metrics.assetsInMaintenance,
      accent: "rgba(215,121,103,0.12)",
    },
    {
      label: "Atribuições ativas",
      value: metrics.activeAssignments,
      accent: "rgba(44,100,112,0.1)",
    },
  ];

  return (
    <AppShell
      current="dashboard"
      title="Dashboard"
      subtitle="Visao consolidada do inventario, com leitura rapida de ativos, manutencoes e atribuicoes em andamento."
      contentSize="wide"
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
              <section className="metrics-grid">
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
                      Ativos por localização
                    </h2>
                    <p className="mt-1 text-sm [color:var(--text-secondary)]">
                      Clique em uma localização para abrir a lista filtrada.
                    </p>
                  </div>
                  <div className="status-pill">
                    {loading
                      ? "Carregando..."
                      : `${locationBreakdown.items.length} localizaç${locationBreakdown.items.length === 1 ? "ão" : "ões"}`}
                  </div>
                </div>

                {loading ? (
                  <div className="px-6 py-8 text-sm [color:var(--text-secondary)]">
                    Calculando distribuição por localização...
                  </div>
                ) : locationBreakdown.items.length === 0 ? (
                  <div className="px-6 py-8 text-sm [color:var(--text-secondary)]">
                    Nenhum ativo com localização cadastrada.
                  </div>
                ) : (
                  <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-3">
                    {locationBreakdown.items.map((location) => (
                      <button
                        key={location.id}
                        type="button"
                          onClick={() =>
                            router.push(
                              `/assets?locationId=${encodeURIComponent(location.id)}`,
                            )
                        }
                        className="surface-soft rounded-[24px] p-4 text-left transition hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.9)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold [color:var(--text-primary)]">
                              {location.name}
                            </div>
                            <div className="mt-1 text-xs [color:var(--text-secondary)]">
                              {location.count} ativo(s)
                            </div>
                          </div>
                          <div className="status-pill">{location.percent}%</div>
                        </div>

                        <div className="mt-4 h-2 rounded-full bg-[rgba(23,58,67,0.08)]">
                          <div
                            className="h-2 rounded-full bg-[linear-gradient(135deg,var(--brand-teal-800),var(--brand-coral-500))]"
                            style={{ width: `${Math.max(location.percent, 6)}%` }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {locationBreakdown.withoutLocation > 0 ? (
                  <div className="border-t px-6 py-4 text-sm [border-color:var(--border-soft)] [color:var(--text-secondary)]">
                    {locationBreakdown.withoutLocation} ativo(s) sem localização
                    vinculada.
                  </div>
                ) : null}
              </section>

              <section className="overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
                <div className="flex flex-col gap-2 border-b px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold [color:var(--text-primary)]">
                      Atribuições ativas
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
                          <th>Ativo</th>
                          <th>Funcionário</th>
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
                                {assignment.asset?.brand ?? "Ativo"}
                              </div>
                            </td>
                            <td>
                              <div className="cell-strong">
                                {assignment.employee?.name ??
                                  assignment.employeeId ??
                                  "Funcionário removido"}
                              </div>
                              <div className="mt-1 text-xs [color:var(--text-muted)]">
                                {assignment.employee?.email ?? "Funcionário removido"}
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
                  O inventário ainda não possui ativos nem atribuições. Cadastre o
                  primeiro ativo para iniciar o acompanhamento.
                </section>
              )}
            </>
          )}
    </AppShell>
  );
}
