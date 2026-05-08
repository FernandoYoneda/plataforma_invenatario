"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveAssignments, getAssets } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { Assignment, Asset } from "@/lib/types";
import AppNavigation from "./AppNavigation";

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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f4e8dd,transparent_36%),linear-gradient(180deg,#f8f4ee_0%,#efe7dc_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 rounded-[28px] border border-black/10 bg-white/90 px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8c5f46]">
              Inventario TI
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1f2937]">
              Dashboard
            </h1>
            <p className="mt-2 text-sm text-[#6b7280]">
              Visao geral do inventario e das atribuicoes ativas.
            </p>
          </div>

          <AppNavigation current="dashboard" />
        </header>

        {redirecting ? (
          <section className="rounded-[28px] border border-black/10 bg-white px-6 py-10 text-sm text-[#6b7280] shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            Redirecionando para o login...
          </section>
        ) : error ? (
          <section className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-10 text-sm text-rose-700 shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
            {error}
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: "Total de assets", value: metrics.totalAssets },
                { label: "Assets em estoque", value: metrics.assetsInStock },
                { label: "Assets atribuidos", value: metrics.assetsAssigned },
                {
                  label: "Assets em manutencao",
                  value: metrics.assetsInMaintenance,
                },
                {
                  label: "Assignments ativos",
                  value: metrics.activeAssignments,
                },
              ].map((card) => (
                <article
                  key={card.label}
                  className="rounded-[28px] border border-black/10 bg-white px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)]"
                >
                  <div className="text-sm text-[#6b7280]">{card.label}</div>
                  <div className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#1f2937]">
                    {loading ? "..." : card.value}
                  </div>
                </article>
              ))}
            </section>

            <section className="mt-8 overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
              <div className="border-b border-black/10 px-6 py-4">
                <h2 className="text-lg font-semibold text-[#1f2937]">
                  Ultimos assignments ativos
                </h2>
                <p className="mt-1 text-sm text-[#6b7280]">
                  Lista simples usando apenas o endpoint atual de assignments ativos.
                </p>
              </div>

              {loading ? (
                <div className="px-6 py-8 text-sm text-[#6b7280]">
                  Carregando dashboard...
                </div>
              ) : assignments.length === 0 ? (
                <div className="px-6 py-8 text-sm text-[#6b7280]">
                  Nenhum assignment ativo encontrado.
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {!loading && assets.length === 0 && assignments.length === 0 && (
              <section className="mt-8 rounded-[28px] border border-black/10 bg-white px-6 py-8 text-sm text-[#6b7280] shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
                O inventario ainda nao possui assets nem assignments. Cadastre o
                primeiro asset para iniciar o acompanhamento.
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
