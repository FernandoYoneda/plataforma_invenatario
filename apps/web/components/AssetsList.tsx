"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getActiveAssignments,
  getAssets,
  getCategories,
  getLocations,
} from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type {
  Asset,
  AssetStatus,
  AssetType,
  Assignment,
  Category,
  Location,
} from "@/lib/types";
import ActiveAssignmentsPanel from "./ActiveAssignmentsPanel";
import AppShell from "./AppShell";
import AssignAssetModal from "./AssignAssetModal";
import AssetHistoryModal from "./AssetHistoryModal";
import AssetQrCodeModal from "./AssetQrCodeModal";
import EditAssetModal from "./EditAssetModal";
import NewAssetModal from "./NewAssetModal";

const TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: "DESKTOP", label: "Desktop" },
  { value: "NOTEBOOK", label: "Notebook" },
  { value: "MONITOR", label: "Monitor" },
  { value: "MOUSE", label: "Mouse" },
  { value: "TECLADO", label: "Teclado" },
  { value: "OUTRO", label: "Outro" },
];

const STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: "EM_USO", label: "Em uso" },
  { value: "ESTOQUE", label: "Estoque" },
  { value: "MANUTENCAO", label: "Manutencao" },
  { value: "BAIXADO", label: "Baixado" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

type SortKey =
  | "internalCode"
  | "type"
  | "brand"
  | "model"
  | "status"
  | "category"
  | "location";

type SortDirection = "asc" | "desc";

function moneyBRL(valueCents?: number | null) {
  if (valueCents == null) return "-";

  return (valueCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function labelType(type: Asset["type"]) {
  return TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type;
}

function labelStatus(status: Asset["status"]) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

function assetCategoryId(asset: Asset) {
  return asset.categoryId ?? asset.category?.id ?? "";
}

function assetLocationId(asset: Asset) {
  return asset.locationId ?? asset.location?.id ?? "";
}

function assetCategoryName(asset: Asset, categories: Category[]) {
  const id = assetCategoryId(asset);
  return (
    asset.category?.name ??
    categories.find((item) => item.id === id)?.name ??
    "-"
  );
}

function assetLocationName(asset: Asset, locations: Location[]) {
  const id = assetLocationId(asset);
  return (
    asset.location?.name ??
    locations.find((item) => item.id === id)?.name ??
    "-"
  );
}

function sortValue(asset: Asset, key: SortKey, categories: Category[], locations: Location[]) {
  const values: Record<SortKey, string> = {
    internalCode: asset.internalCode,
    type: labelType(asset.type),
    brand: asset.brand,
    model: asset.model ?? "",
    status: labelStatus(asset.status),
    category: assetCategoryName(asset, categories),
    location: assetLocationName(asset, locations),
  };

  return values[key];
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [referencesError, setReferencesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("internalCode");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
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

  async function loadReferences() {
    const token = getAuthToken();

    if (!token) {
      setRedirecting(true);
      router.replace("/login");
      return;
    }

    try {
      const [categoriesData, locationsData] = await Promise.all([
        getCategories(token),
        getLocations(token),
      ]);

      setCategories(categoriesData);
      setLocations(locationsData);
      setReferencesError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Nao foi possivel carregar categorias e localizacoes.";

      handleAuthError(err);
      setReferencesError(message);
    }
  }

  useEffect(() => {
    async function load() {
      await Promise.all([loadAssets(), loadActiveAssignments(), loadReferences()]);
    }

    load();
  }, [router]);

  const filteredAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          asset.internalCode,
          asset.brand,
          asset.model ?? "",
          asset.serialNumber ?? "",
        ].some((value) => value.toLowerCase().includes(normalizedSearch));

      const matchesStatus = !statusFilter || asset.status === statusFilter;
      const matchesType = !typeFilter || asset.type === typeFilter;
      const matchesCategory =
        !categoryFilter || assetCategoryId(asset) === categoryFilter;
      const matchesLocation =
        !locationFilter || assetLocationId(asset) === locationFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesCategory &&
        matchesLocation
      );
    });
  }, [assets, categoryFilter, locationFilter, search, statusFilter, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, locationFilter, search, statusFilter, typeFilter]);

  const sortedAssets = useMemo(() => {
    return [...filteredAssets].sort((a, b) => {
      const aValue = sortValue(a, sortKey, categories, locations);
      const bValue = sortValue(b, sortKey, categories, locations);
      const result = aValue.localeCompare(bValue, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });

      if (result !== 0) {
        return sortDirection === "asc" ? result : -result;
      }

      return a.internalCode.localeCompare(b.internalCode, "pt-BR", {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [categories, filteredAssets, locations, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedAssets.length / pageSize));
  const pageStartIndex = (currentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, sortedAssets.length);
  const paginatedAssets = sortedAssets.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const hasFilters = Boolean(
    search.trim() ||
      statusFilter ||
      typeFilter ||
      categoryFilter ||
      locationFilter,
  );

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setCategoryFilter("");
    setLocationFilter("");
  }

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("asc");
  }

  function sortLabel(key: SortKey) {
    if (sortKey !== key) return "";

    return sortDirection === "asc" ? " ASC" : " DESC";
  }

  function sortableHeader(key: SortKey, label: string) {
    return (
      <button
        type="button"
        onClick={() => handleSort(key)}
        className="inline-flex items-center gap-1 text-left font-semibold uppercase tracking-[0.08em] [color:inherit]"
      >
        <span>{label}</span>
        {sortKey === key ? (
          <span className="text-[0.62rem] [color:var(--brand-coral-500)]">
            {sortLabel(key)}
          </span>
        ) : null}
      </button>
    );
  }

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
                    : hasFilters
                      ? `${filteredAssets.length} de ${assets.length} asset(s)`
                      : `${assets.length} asset(s)`}
              </div>
              <Link
                href="/login"
                className="text-sm font-medium [color:var(--brand-teal-700)] underline-offset-4 hover:underline"
              >
                Ir para login
              </Link>
            </div>

            {!redirecting && !error && !loading ? (
              <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
                <div className="grid gap-4 lg:grid-cols-[minmax(14rem,1.4fr)_repeat(4,minmax(9rem,1fr))_auto] lg:items-end">
                  <label className="block text-sm">
                    <span className="font-medium [color:var(--text-primary)]">
                      Buscar
                    </span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="brand-input mt-1.5"
                      placeholder="Codigo, marca, modelo ou serial"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium [color:var(--text-primary)]">
                      Status
                    </span>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="brand-input mt-1.5"
                    >
                      <option value="">Todos</option>
                      {STATUS_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium [color:var(--text-primary)]">
                      Tipo
                    </span>
                    <select
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                      className="brand-input mt-1.5"
                    >
                      <option value="">Todos</option>
                      {TYPE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium [color:var(--text-primary)]">
                      Categoria
                    </span>
                    <select
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                      className="brand-input mt-1.5"
                    >
                      <option value="">Todas</option>
                      {categories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium [color:var(--text-primary)]">
                      Localizacao
                    </span>
                    <select
                      value={locationFilter}
                      onChange={(event) => setLocationFilter(event.target.value)}
                      className="brand-input mt-1.5"
                    >
                      <option value="">Todas</option>
                      {locations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={clearFilters}
                    disabled={!hasFilters}
                    className="btn-secondary px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Limpar filtros
                  </button>
                </div>

                {referencesError ? (
                  <div className="status-banner-warning mt-4 rounded-[22px] px-4 py-3 text-sm">
                    {referencesError}
                  </div>
                ) : null}
              </div>
            ) : null}

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
                Nenhum ativo cadastrado
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
                Nenhum ativo encontrado com esses filtros
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table data-table-compact">
                    <thead>
                      <tr>
                        <th>{sortableHeader("internalCode", "Codigo")}</th>
                        <th>{sortableHeader("type", "Tipo")}</th>
                        <th>{sortableHeader("brand", "Marca")}</th>
                        <th>{sortableHeader("model", "Modelo")}</th>
                        <th>Serial</th>
                        <th>{sortableHeader("status", "Status")}</th>
                        <th>{sortableHeader("category", "Categoria")}</th>
                        <th>{sortableHeader("location", "Localizacao")}</th>
                        <th className="text-right">Valor</th>
                        <th className="text-right">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAssets.map((asset) => (
                        <tr key={asset.id}>
                          <td className="cell-strong">{asset.internalCode}</td>
                          <td>{labelType(asset.type)}</td>
                          <td>{asset.brand}</td>
                          <td>{asset.model ?? "-"}</td>
                          <td>{asset.serialNumber ?? "-"}</td>
                          <td>{labelStatus(asset.status)}</td>
                          <td>{assetCategoryName(asset, categories)}</td>
                          <td>{assetLocationName(asset, locations)}</td>
                          <td className="text-right">{moneyBRL(asset.valueCents)}</td>
                          <td>
                            <div className="flex justify-end gap-2">
                              <AssignAssetModal
                                asset={asset}
                                onAssigned={(assignment) => {
                                  setActiveAssignments((current) => [
                                    assignment,
                                    ...current.filter(
                                      (item) =>
                                        item.assetId !== assignment.assetId,
                                    ),
                                  ]);
                                  setHistoryRefreshKey((current) => current + 1);
                                }}
                              />
                              <EditAssetModal
                                asset={asset}
                                categories={categories}
                                locations={locations}
                                onUpdated={(updatedAsset) => {
                                  setAssets((current) =>
                                    current.map((item) =>
                                      item.id === updatedAsset.id
                                        ? updatedAsset
                                        : item,
                                    ),
                                  );
                                  setError(null);
                                  setHistoryRefreshKey((current) => current + 1);
                                }}
                              />
                              <AssetHistoryModal
                                asset={asset}
                                refreshKey={historyRefreshKey}
                              />
                              <AssetQrCodeModal asset={asset} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-4 border-t px-6 py-5 [border-color:var(--border-soft)] lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-sm [color:var(--text-secondary)]">
                    Mostrando {pageStartIndex + 1}-{pageEndIndex} de{" "}
                    {sortedAssets.length} asset(s)
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <label className="flex items-center gap-2 text-sm [color:var(--text-secondary)]">
                      <span>Itens por pagina</span>
                      <select
                        value={pageSize}
                        onChange={(event) => {
                          setPageSize(Number(event.target.value));
                          setCurrentPage(1);
                        }}
                        className="brand-input w-auto min-w-24 py-2 text-sm"
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
                </div>
              </>
            )}
          </section>
    </AppShell>
  );
}
