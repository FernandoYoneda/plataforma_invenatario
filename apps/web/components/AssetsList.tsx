"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getActiveAssignments,
  getAssets,
  getCategories,
  getLocations,
} from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import * as XLSX from "xlsx";
import type {
  Asset,
  AssetStatus,
  AssetType,
  Category,
  Location,
  Assignment,
} from "@/lib/types";
import AppShell from "./AppShell";
import AssignAssetModal from "./AssignAssetModal";
import AssetHistoryModal from "./AssetHistoryModal";
import AssetQrCodeModal from "./AssetQrCodeModal";
import ImportAssetsModal from "./ImportAssetsModal";
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

type ExportFormat = "csv" | "xlsx";

function moneyBRL(valueCents?: number | null) {
  if (valueCents == null) return "-";

  return (valueCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatFileTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") +
    "_" +
    [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("-");
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

function csvCell(value: string | number | null | undefined) {
  const text = value == null || value === "" ? "-" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AssetsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [assignmentRefreshKey, setAssignmentRefreshKey] = useState(0);
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
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const locationIdFromQuery = searchParams.get("locationId") ?? "";
  const queryLocationName =
    locations.find((item) => item.id === locationIdFromQuery)?.name ?? "";

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
      return;
    }

    try {
      const data = await getActiveAssignments(token);
      setActiveAssignments(data);
    } catch (err: unknown) {
      handleAuthError(err);
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
          : "Não foi possível carregar categorias e localizações.";

      handleAuthError(err);
      setReferencesError(message);
    }
  }

  useEffect(() => {
    async function load() {
      await Promise.all([loadAssets(), loadReferences(), loadActiveAssignments()]);
    }

    load();
  }, [router]);

  useEffect(() => {
    loadActiveAssignments();
  }, [assignmentRefreshKey]);

  useEffect(() => {
    setLocationFilter(locationIdFromQuery);
  }, [locationIdFromQuery]);

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

  const activeAssignmentByAssetId = useMemo(() => {
    return new Map(activeAssignments.map((assignment) => [assignment.assetId, assignment]));
  }, [activeAssignments]);

  const totalPages = Math.max(1, Math.ceil(sortedAssets.length / pageSize));
  const pageStartIndex = (currentPage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, sortedAssets.length);
  const paginatedAssets = sortedAssets.slice(pageStartIndex, pageEndIndex);
  const selectedAssetSet = useMemo(
    () => new Set(selectedAssetIds),
    [selectedAssetIds],
  );
  const selectedCount = selectedAssetIds.length;
  const visibleSelectedCount = paginatedAssets.filter((asset) =>
    selectedAssetSet.has(asset.id),
  ).length;
  const allVisibleSelected =
    paginatedAssets.length > 0 && visibleSelectedCount === paginatedAssets.length;
  const someVisibleSelected =
    visibleSelectedCount > 0 && visibleSelectedCount < paginatedAssets.length;
  const printLabelsHref = useMemo(() => {
    if (selectedAssetIds.length === 0) {
      return "/assets/print-labels";
    }

    const params = new URLSearchParams();
    params.set("ids", selectedAssetIds.join(","));
    return `/assets/print-labels?${params.toString()}`;
  }, [selectedAssetIds]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setSelectedAssetIds((current) => {
      if (current.length === 0) {
        return current;
      }

      const next = current.filter((assetId) =>
        filteredAssets.some((asset) => asset.id === assetId),
      );

      if (
        next.length === current.length &&
        next.every((assetId, index) => assetId === current[index])
      ) {
        return current;
      }

      return next;
    });
  }, [filteredAssets]);

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

  function clearLocationQueryFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("locationId");
    router.replace(params.toString() ? `/assets?${params.toString()}` : "/assets");
  }

  function toggleAssetSelection(assetId: string) {
    setSelectedAssetIds((current) =>
      current.includes(assetId)
        ? current.filter((item) => item !== assetId)
        : [...current, assetId],
    );
  }

  function toggleCurrentPageSelection() {
    setSelectedAssetIds((current) => {
      const currentSet = new Set(current);

      if (allVisibleSelected) {
        return current.filter((assetId) => !paginatedAssets.some((asset) => asset.id === assetId));
      }

      const next = [...current];

      for (const asset of paginatedAssets) {
        if (!currentSet.has(asset.id)) {
          next.push(asset.id);
        }
      }

      return next;
    });
  }

  function clearSelection() {
    setSelectedAssetIds([]);
  }

  function currentEmployeeName(asset: Asset) {
    const assignment = activeAssignmentByAssetId.get(asset.id);

    if (!assignment) {
      return "-";
    }

    return assignment.employee?.name ?? "Funcionário removido";
  }

  function exportRows() {
    return sortedAssets.map((asset) => [
      asset.internalCode,
      labelType(asset.type),
      asset.brand,
      asset.model ?? "",
      asset.serialNumber ?? "",
      assetCategoryName(asset, categories),
      assetLocationName(asset, locations),
      labelStatus(asset.status),
      currentEmployeeName(asset),
      moneyBRL(asset.valueCents),
    ]);
  }

  function exportFileName(format: ExportFormat) {
    return `ativos-filtrados-${formatFileTimestamp()}.${format}`;
  }

  function exportCsv() {
    const header = [
      "codigo",
      "tipo",
      "marca",
      "modelo",
      "serial",
      "categoria",
      "localizacao",
      "status",
      "funcionario_atual",
      "valor",
    ];

    const rows = [
      header,
      ...exportRows().map((row) => row.map(csvCell)),
    ];

    const csv = rows.map((row) => row.join(";")).join("\r\n");
    const blob = new Blob([`\ufeff${csv}`], {
      type: "text/csv;charset=utf-8",
    });

    downloadBlob(exportFileName("csv"), blob);
    setExportOpen(false);
  }

  function exportXlsx() {
    const rows = [
      [
        "codigo",
        "tipo",
        "marca",
        "modelo",
        "serial",
        "categoria",
        "localizacao",
        "status",
        "funcionario_atual",
        "valor",
      ],
      ...exportRows(),
    ];

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Ativos");
    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    downloadBlob(
      exportFileName("xlsx"),
      new Blob([buffer], {
        type:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    setExportOpen(false);
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

    return sortDirection === "asc" ? " ↑" : " ↓";
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
      title="Ativos"
      subtitle="Consulta principal de ativos, com criação, atribuições e histórico disponíveis na mesma tela."
      contentSize="wide"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((current) => !current)}
              disabled={loading || redirecting || Boolean(error) || sortedAssets.length === 0}
              className="btn-secondary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              Exportar
            </button>

            {exportOpen ? (
              <div className="absolute right-0 z-20 mt-2 min-w-40 overflow-hidden rounded-[18px] border bg-[var(--surface-card)] p-1 shadow-[0_18px_40px_rgba(23,58,67,0.16)] [border-color:var(--border-soft)]">
                <button
                  type="button"
                  onClick={exportCsv}
                  className="flex w-full items-center rounded-[14px] px-3 py-2 text-left text-sm [color:var(--text-primary)] hover:bg-[rgba(44,100,112,0.08)]"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={exportXlsx}
                  className="flex w-full items-center rounded-[14px] px-3 py-2 text-left text-sm [color:var(--text-primary)] hover:bg-[rgba(44,100,112,0.08)]"
                >
                  Excel
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
          <NewAssetModal
            onCreated={(asset) => {
              setAssets((current) => [asset, ...current]);
              setError(null);
            }}
          />
          <ImportAssetsModal
            assets={assets}
            categories={categories}
            locations={locations}
            onImported={(imported) => {
              setAssets((current) => {
                const importedIds = new Set(imported.map((asset) => asset.id));
                return [
                  ...imported,
                  ...current.filter((asset) => !importedIds.has(asset.id)),
                ];
              });
              setError(null);
              setCurrentPage(1);
              setHistoryRefreshKey((current) => current + imported.length);
              setAssignmentRefreshKey((current) => current + imported.length);
            }}
          />
          </div>
        </div>
      }
    >
          {locationIdFromQuery ? (
            <section className="surface-soft flex flex-col gap-3 rounded-[24px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm [color:var(--text-secondary)]">
                <span className="font-medium [color:var(--text-primary)]">
                  Filtro aplicado:
                </span>{" "}
                Localização {queryLocationName || "Selecionada"}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={clearLocationQueryFilter}
                  className="btn-secondary px-4 py-2.5 text-sm"
                >
                  Limpar filtro
                </button>
                <Link
                  href="/dashboard"
                  className="btn-secondary px-4 py-2.5 text-sm"
                >
                  Voltar ao Dashboard
                </Link>
              </div>
            </section>
            ) : null}

          <section className="overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
            <div className="flex flex-col gap-3 border-b px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
              <div className="status-pill">
                {redirecting
                  ? "Redirecionando..."
                  : loading
                    ? "Carregando..."
                    : hasFilters
              ? `${filteredAssets.length} de ${assets.length} ativo(s)`
                      : `${assets.length} ativo(s)`}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedCount > 0 ? (
                  <>
                    <span className="status-pill">
                      {selectedCount} selecionado(s)
                    </span>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="btn-secondary px-4 py-2.5 text-sm"
                    >
                      Limpar selecao
                    </button>
                    <Link
                      href={printLabelsHref}
                      className="btn-primary px-4 py-2.5 text-sm"
                    >
                      Imprimir etiquetas
                    </Link>
                  </>
                ) : null}
                <Link
                  href="/login"
                  className="text-sm font-medium [color:var(--brand-teal-700)] underline-offset-4 hover:underline"
                >
                  Ir para login
                </Link>
              </div>
            </div>

            {!redirecting && !error && !loading ? (
              <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(14rem,1.4fr)_repeat(4,minmax(9rem,1fr))_auto] 2xl:items-end">
                  <label className="block text-sm">
                    <span className="font-medium [color:var(--text-primary)]">
                      Buscar
                    </span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="brand-input mt-1.5"
                      placeholder="Código, marca, modelo ou serial"
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
                      Localização
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
                Buscando ativos...
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
                        <th className="w-14">
                          <label className="inline-flex items-center gap-2 whitespace-nowrap text-[0.72rem] font-semibold uppercase tracking-[0.08em] [color:var(--text-muted)]">
                            <input
                              ref={(input) => {
                                if (input) {
                                  input.indeterminate = someVisibleSelected;
                                }
                              }}
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={toggleCurrentPageSelection}
                              aria-label="Selecionar todos os ativos da pagina atual"
                              className="h-4 w-4 rounded border-[color:var(--border-strong)] accent-[color:var(--brand-teal-700)]"
                            />
                            <span>Selecionar todos</span>
                          </label>
                        </th>
                    <th>{sortableHeader("internalCode", "Código")}</th>
                        <th>{sortableHeader("type", "Tipo")}</th>
                        <th>{sortableHeader("brand", "Marca")}</th>
                        <th>{sortableHeader("model", "Modelo")}</th>
                        <th>Serial</th>
                        <th>{sortableHeader("status", "Status")}</th>
                        <th>{sortableHeader("category", "Categoria")}</th>
                        <th>{sortableHeader("location", "Localização")}</th>
                        <th className="text-right">Valor</th>
                        <th className="asset-actions-column text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAssets.map((asset) => (
                        <tr key={asset.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedAssetSet.has(asset.id)}
                              onChange={() => toggleAssetSelection(asset.id)}
                              aria-label={`Selecionar ativo ${asset.internalCode}`}
                              className="h-4 w-4 rounded border-[color:var(--border-strong)] accent-[color:var(--brand-teal-700)]"
                            />
                          </td>
                          <td className="cell-strong">{asset.internalCode}</td>
                          <td>{labelType(asset.type)}</td>
                          <td>{asset.brand}</td>
                          <td>{asset.model ?? "-"}</td>
                          <td>{asset.serialNumber ?? "-"}</td>
                          <td>{labelStatus(asset.status)}</td>
                          <td>{assetCategoryName(asset, categories)}</td>
                          <td>{assetLocationName(asset, locations)}</td>
                          <td className="text-right">{moneyBRL(asset.valueCents)}</td>
                          <td className="asset-actions-column">
                            <div className="asset-actions-row">
                          <AssignAssetModal
                            asset={asset}
                            onAssigned={() => {
                              setAssignmentRefreshKey((current) => current + 1);
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
                              <Link
                                href={`/assets/${asset.id}`}
                                className="action-button"
                              >
                                Ver detalhes
                              </Link>
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
                    {sortedAssets.length} ativo(s)
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
