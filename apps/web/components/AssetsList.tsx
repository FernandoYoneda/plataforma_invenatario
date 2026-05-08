"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getActiveAssignments, getAssets } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { Asset, Assignment } from "@/lib/types";
import ActiveAssignmentsPanel from "./ActiveAssignmentsPanel";
import AssignAssetModal from "./AssignAssetModal";
import AssetHistoryModal from "./AssetHistoryModal";
import NewAssetModal from "./NewAssetModal";
import LogoutButton from "./LogoutButton";

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f4e8dd,transparent_36%),linear-gradient(180deg,#f8f4ee_0%,#efe7dc_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 rounded-[28px] border border-black/10 bg-white/90 px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8c5f46]">
              Inventario TI
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1f2937]">
              Assets
            </h1>
            <p className="mt-2 text-sm text-[#6b7280]">
              Listagem simples consumindo o endpoint GET /assets.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <NewAssetModal
              onCreated={(asset) => {
                setAssets((current) => [asset, ...current]);
                setError(null);
              }}
            />
            <LogoutButton />
          </div>
        </header>

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

        <section className="overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.10)]">
          <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
            <div className="text-sm text-[#6b7280]">
              {redirecting
                ? "Redirecionando..."
                : loading
                  ? "Carregando..."
                  : `${assets.length} asset(s)`}
            </div>
            <Link
              href="/login"
              className="text-sm font-medium text-[#8c5f46] underline-offset-4 hover:underline"
            >
              Ir para login
            </Link>
          </div>

          {redirecting ? (
            <div className="px-6 py-10 text-sm text-[#6b7280]">
              Redirecionando para o login...
            </div>
          ) : error ? (
            <div className="px-6 py-10 text-sm text-[#b42318]">{error}</div>
          ) : loading ? (
            <div className="px-6 py-10 text-sm text-[#6b7280]">
              Buscando assets...
            </div>
          ) : assets.length === 0 ? (
            <div className="px-6 py-10 text-sm text-[#6b7280]">
              Nenhum asset encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#f9f5ef] text-[#6b7280]">
                  <tr>
                    <th className="px-6 py-3 font-medium">Codigo</th>
                    <th className="px-6 py-3 font-medium">Tipo</th>
                    <th className="px-6 py-3 font-medium">Marca</th>
                    <th className="px-6 py-3 font-medium">Modelo</th>
                    <th className="px-6 py-3 font-medium">Serial</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 text-right font-medium">Valor</th>
                    <th className="px-6 py-3 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className="border-t border-black/5">
                      <td className="px-6 py-4 font-medium text-[#111827]">
                        {asset.internalCode}
                      </td>
                      <td className="px-6 py-4 text-[#374151]">
                        {labelType(asset.type)}
                      </td>
                      <td className="px-6 py-4 text-[#374151]">{asset.brand}</td>
                      <td className="px-6 py-4 text-[#374151]">
                        {asset.model ?? "-"}
                      </td>
                      <td className="px-6 py-4 text-[#374151]">
                        {asset.serialNumber ?? "-"}
                      </td>
                      <td className="px-6 py-4 text-[#374151]">
                        {labelStatus(asset.status)}
                      </td>
                      <td className="px-6 py-4 text-right text-[#374151]">
                        {moneyBRL(asset.valueCents)}
                      </td>
                      <td className="px-6 py-4">
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
      </div>
    </main>
  );
}
