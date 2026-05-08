"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getActiveAssignments, getAssets } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { Asset, Assignment } from "@/lib/types";
import ActiveAssignmentsPanel from "./ActiveAssignmentsPanel";
import AppShell from "./AppShell";
import AssignAssetModal from "./AssignAssetModal";
import AssetHistoryModal from "./AssetHistoryModal";
import NewAssetModal from "./NewAssetModal";

function moneyBRL(valueCents?: number | null) {
  if (valueCents == null) return "-";

  return (valueCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function labelType(type: Asset["type"]) {
  const labels: Record<Asset["type"], string> = {
    DESKTOP: "Desktop",
    NOTEBOOK: "Notebook",
    MONITOR: "Monitor",
    MOUSE: "Mouse",
    TECLADO: "Teclado",
    OUTRO: "Outro",
  };

  return labels[type] ?? type;
}

function labelStatus(status: Asset["status"]) {
  const labels: Record<Asset["status"], string> = {
    EM_USO: "Em uso",
    ESTOQUE: "Estoque",
    MANUTENCAO: "Manutencao",
    BAIXADO: "Baixado",
  };

  return labels[status] ?? status;
}

export default function AssetsList() {
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

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

  async function loadAssets() {
    const token = getAuthToken();

    if (!token) {
      setRedirecting(true);
      setLoading(false);
      router.replace("/login");
      return;
    }

    try {
      const data = await getAssets(token);
      setAssets(data);
      setError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nao foi possivel carregar os ativos.";

      handleAuthError(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function loadActiveAssignments() {
    const token = getAuthToken();

    if (!token) {
      setRedirecting(true);
      setLoadingAssignments(false);
      router.replace("/login");
      return;
    }

    try {
      const data = await getActiveAssignments(token);
      setActiveAssignments(data);
      setAssignmentsError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Nao foi possivel carregar os assignments ativos.";

      handleAuthError(err);
      setAssignmentsError(message);
    } finally {
      setLoadingAssignments(false);
    }
  }

  useEffect(() => {
    async function load() {
      await Promise.all([loadAssets(), loadActiveAssignments()]);
    }

    load();
  }, [router]);

  return (
    <AppShell
      current="assets"
      title="Assets"
      subtitle="Consulta principal de ativos, com criacao, atribuicoes e historico disponiveis na mesma tela."
      actions={
        <NewAssetModal
          onCreated={(asset) => {
            setAssets((current) => [asset, ...current]);
            setError(null);
          }}
        />
      }
    >
          <ActiveAssignmentsPanel
            assignments={activeAssignments}
            loading={loadingAssignments}
            error={assignmentsError}
            onReturned={(assignmentId) => {
              setActiveAssignments((current) =>
                current.filter((item) => item.id !== assignmentId),
              );
              setHistoryRefreshKey((current) => current + 1);
            }}
          />

          <section className="overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
            <div className="flex flex-col gap-3 border-b px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
              <div className="status-pill">
                {redirecting
                  ? "Redirecionando..."
                  : loading
                    ? "Carregando..."
                    : `${assets.length} asset(s)`}
              </div>
              <Link
                href="/login"
                className="text-sm font-medium [color:var(--brand-teal-700)] underline-offset-4 hover:underline"
              >
                Ir para login
              </Link>
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
                Buscando assets...
              </div>
            ) : assets.length === 0 ? (
              <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
                Nenhum asset encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table data-table-compact">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Tipo</th>
                      <th>Marca</th>
                      <th>Modelo</th>
                      <th>Serial</th>
                      <th>Status</th>
                      <th className="text-right">Valor</th>
                      <th className="text-right">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.id}>
                        <td className="cell-strong">{asset.internalCode}</td>
                        <td>{labelType(asset.type)}</td>
                        <td>{asset.brand}</td>
                        <td>{asset.model ?? "-"}</td>
                        <td>{asset.serialNumber ?? "-"}</td>
                        <td>{labelStatus(asset.status)}</td>
                        <td className="text-right">{moneyBRL(asset.valueCents)}</td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <AssignAssetModal
                              asset={asset}
                              onAssigned={(assignment) => {
                                setActiveAssignments((current) => [
                                  assignment,
                                  ...current.filter(
                                    (item) => item.assetId !== assignment.assetId,
                                  ),
                                ]);
                                setHistoryRefreshKey((current) => current + 1);
                              }}
                            />
                            <AssetHistoryModal
                              asset={asset}
                              refreshKey={historyRefreshKey}
                            />
                          </div>
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
