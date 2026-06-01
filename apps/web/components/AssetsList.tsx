"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  deleteAsset,
  getActiveAssignments,
  getAssetAttachments,
  getAssetDetails,
  getAssets,
  getCategories,
  getLocations,
  returnAssignment,
} from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { useAuth } from "./AuthProvider";
import { canExportReports, canManageAssets } from "@/lib/permissions";
import * as XLSX from "xlsx";
import { toast } from "sonner";
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
  { value: "SMARTPHONE", label: "Smartphone" },
  { value: "OUTRO", label: "Outro" },
];

const STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: "EM_USO", label: "Em uso" },
  { value: "ESTOQUE", label: "Estoque" },
  { value: "MANUTENCAO", label: "Manutencao" },
  { value: "BAIXADO", label: "Baixado" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const ACTIVE_ASSIGNMENT_DELETE_MESSAGE =
  "Este ativo possui atribuição ativa.\nFaça a devolução antes de excluir\nou altere o status para Baixado.";

type SortKey =
  | "internalCode"
  | "type"
  | "brand"
  | "model"
  | "status"
  | "category"
  | "location";

type SortDirection = "asc" | "desc";

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function moneyBRL(valueCents?: number | null) {
  if (valueCents == null) return "-";

  return (valueCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return parsed.toLocaleDateString("pt-BR");
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

function statusBadgeClass(status: Asset["status"]) {
  switch (status) {
    case "EM_USO":
      return "asset-status-badge asset-status-badge-success";
    case "ESTOQUE":
      return "asset-status-badge asset-status-badge-info";
    case "MANUTENCAO":
      return "asset-status-badge asset-status-badge-warning";
    case "BAIXADO":
      return "asset-status-badge asset-status-badge-danger";
    default:
      return "asset-status-badge";
  }
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

function formatWorksheet(sheet: XLSX.WorkSheet, rows: string[][]) {
  sheet["!cols"] = rows[0].map((_, columnIndex) => {
    const width = rows.reduce((max, row) => {
      const cellLength = String(row[columnIndex] ?? "").length;
      return Math.max(max, cellLength);
    }, 0);

    return { wch: Math.min(Math.max(width + 2, 12), 42) };
  });

  for (let columnIndex = 0; columnIndex < rows[0].length; columnIndex += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: columnIndex });
    const cell = sheet[cellAddress];
    if (cell) {
      cell.s = { font: { bold: true } };
    }
  }
}

function ActionMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 5.5v.1" />
      <path d="M12 12v.1" />
      <path d="M12 18.5v.1" />
    </svg>
  );
}

export default function AssetsList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
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
  const [openActionsMenuAssetId, setOpenActionsMenuAssetId] = useState<
    string | null
  >(null);
  const [selectedAssetForAssign, setSelectedAssetForAssign] =
    useState<Asset | null>(null);
  const [selectedAssetForEdit, setSelectedAssetForEdit] = useState<
    Asset | null
  >(null);
  const [selectedAssetForHistory, setSelectedAssetForHistory] =
    useState<Asset | null>(null);
  const [selectedAssetForQr, setSelectedAssetForQr] = useState<Asset | null>(
    null,
  );
  const [returningAssetId, setReturningAssetId] = useState<string | null>(null);
  const [assetPendingDelete, setAssetPendingDelete] = useState<Asset | null>(
    null,
  );
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<{
    historyCount: number;
    attachmentCount: number;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteInfo, setDeleteInfo] = useState<string | null>(null);
  const [returningDeleteAsset, setReturningDeleteAsset] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const locationIdFromQuery = searchParams.get("locationId") ?? "";
  const queryLocationName =
    locations.find((item) => item.id === locationIdFromQuery)?.name ?? "";
  const showBackToLocations = Boolean(locationIdFromQuery);
  const canManageAssetActions = canManageAssets(user?.role);
  const canExportAssets = canExportReports(user?.role);

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

  const loadAssets = useCallback(async () => {
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
  }, [router]);

  const loadActiveAssignments = useCallback(async () => {
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
  }, [router]);

  const loadReferences = useCallback(async () => {
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
  }, [router]);

  const reloadAssetData = useCallback(async () => {
    await Promise.all([loadAssets(), loadActiveAssignments()]);
  }, [loadActiveAssignments, loadAssets]);

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
          asset.phoneNumber1 ?? "",
          asset.phoneNumber2 ?? "",
          asset.imei1 ?? "",
          asset.imei2 ?? "",
          asset.carrier ?? "",
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
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!openActionsMenuAssetId) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(event.target as Node)
      ) {
        setOpenActionsMenuAssetId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openActionsMenuAssetId]);

  useEffect(() => {
    if (!assetPendingDelete) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !deleteLoading &&
        !returningDeleteAsset
      ) {
        closeDeleteModal();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow || "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [assetPendingDelete, deleteLoading, returningDeleteAsset]);

  useEffect(() => {
    if (!assetPendingDelete) return;

    let active = true;
    const token = getAuthToken();

    if (!token) {
      setDeleteImpact(null);
      setDeleteImpactLoading(false);
      setDeleteError("Sessão expirada. Faça login novamente.");
      return;
    }

    setDeleteImpactLoading(true);

    Promise.all([
      getAssetDetails(assetPendingDelete.id, token),
      getAssetAttachments(assetPendingDelete.id, token),
    ])
      .then(([details, attachments]) => {
        if (!active) return;
        setDeleteImpact({
          historyCount: details.history.length,
          attachmentCount: attachments.length,
        });
      })
      .catch(() => {
        if (!active) return;
        setDeleteImpact(null);
      })
      .finally(() => {
        if (active) {
          setDeleteImpactLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [assetPendingDelete]);

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

  function currentEmployeeName(asset: Asset) {
    const assignment = activeAssignmentByAssetId.get(asset.id);

    if (!assignment) {
      return "-";
    }

    return assignment.employee?.name ?? "Funcionário removido";
  }

  async function handleReturnAsset(asset: Asset) {
    const assignment = activeAssignmentByAssetId.get(asset.id);

    if (!assignment) {
      setError("Nao existe atribuicao ativa para este ativo.");
      return;
    }

    const confirmed = window.confirm(
      "Deseja devolver este ativo? O vínculo atual será encerrado.",
    );

    if (!confirmed) return;

    const token = getAuthToken();

    if (!token) {
      setRedirecting(true);
      router.replace("/login");
      return;
    }

    setReturningAssetId(asset.id);
    setError(null);

    try {
      await returnAssignment(assignment.id, {}, token);

      setAssets((current) =>
        current.map((item) =>
          item.id === asset.id
            ? { ...item, status: "ESTOQUE", locationId: null, location: null }
            : item,
        ),
      );

      setActiveAssignments((current) =>
        current.filter((item) => item.id !== assignment.id),
      );

      setAssignmentRefreshKey((current) => current + 1);
      setHistoryRefreshKey((current) => current + 1);
      void reloadAssetData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nao foi possivel devolver o ativo.";
      setError(message);
    } finally {
      setReturningAssetId(null);
    }
  }

  function openDeleteModal(asset: Asset) {
    setAssetPendingDelete(asset);
    setDeleteImpact(null);
    setDeleteError(null);
    setDeleteInfo(null);
  }

  function closeDeleteModal() {
    if (deleteLoading || returningDeleteAsset) return;

    setAssetPendingDelete(null);
    setDeleteImpact(null);
    setDeleteError(null);
    setDeleteInfo(null);
    setDeleteImpactLoading(false);
  }

  function deleteErrorMessage(err: unknown) {
    const message =
      err instanceof Error ? err.message : "Nao foi possivel excluir o ativo.";
    const normalized = message
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (normalized.includes("atribuicao ativa")) {
      return ACTIVE_ASSIGNMENT_DELETE_MESSAGE;
    }

    return message;
  }

  async function handleReturnFromDeleteModal() {
    const asset = assetPendingDelete;
    const assignment = asset ? activeAssignmentByAssetId.get(asset.id) : null;

    if (!asset || !assignment) {
      setDeleteError("Não existe atribuição ativa para este ativo.");
      return;
    }

    const token = getAuthToken();

    if (!token) {
      setDeleteError("Sessão expirada. Faça login novamente.");
      return;
    }

    setReturningDeleteAsset(true);
    setDeleteError(null);
    setDeleteInfo(null);

    try {
      await returnAssignment(assignment.id, {}, token);

      setAssets((current) =>
        current.map((item) =>
          item.id === asset.id
            ? { ...item, status: "ESTOQUE", locationId: null, location: null }
            : item,
        ),
      );
      setActiveAssignments((current) =>
        current.filter((item) => item.id !== assignment.id),
      );
      setAssignmentRefreshKey((current) => current + 1);
      setHistoryRefreshKey((current) => current + 1);
      setDeleteInfo("Atribuição devolvida. Você já pode excluir o ativo.");
      void reloadAssetData();
      toast.success("Ativo devolvido com sucesso.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nao foi possivel devolver o ativo.";
      setDeleteError(message);
    } finally {
      setReturningDeleteAsset(false);
    }
  }

  async function handleConfirmDeleteAsset() {
    const asset = assetPendingDelete;
    if (!asset) return;

    const token = getAuthToken();

    if (!token) {
      setDeleteError("Sessão expirada. Faça login novamente.");
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);
    setDeleteInfo(null);

    try {
      const hasLinkedRecords =
        (deleteImpact?.historyCount ?? 0) > 0 ||
        (deleteImpact?.attachmentCount ?? 0) > 0;

      await deleteAsset(
        asset.id,
        {
          confirmed: hasLinkedRecords,
        },
        token,
      );

      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setActiveAssignments((current) =>
        current.filter((item) => item.assetId !== asset.id),
      );
      setHistoryRefreshKey((current) => current + 1);
      setAssignmentRefreshKey((current) => current + 1);
      setAssetPendingDelete(null);
      setDeleteImpact(null);
      setDeleteError(null);
      setDeleteInfo(null);
      toast.success(`Ativo ${asset.internalCode} excluído com sucesso.`);
    } catch (err: unknown) {
      setDeleteError(deleteErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  function exportRows() {
    return sortedAssets.map((asset) => [
      asset.internalCode,
      labelType(asset.type),
      asset.brand,
      asset.model ?? "",
      asset.serialNumber ?? "",
      formatDate(asset.purchaseDate),
      asset.phoneNumber1 ?? "",
      asset.phoneNumber2 ?? "",
      asset.imei1 ?? "",
      asset.imei2 ?? "",
      asset.carrier ?? "",
      assetCategoryName(asset, categories),
      assetLocationName(asset, locations),
      labelStatus(asset.status),
      currentEmployeeName(asset),
      moneyBRL(asset.valueCents),
    ]);
  }

  function exportFileName() {
    return `ativos-filtrados-${formatFileTimestamp()}.xlsx`;
  }

  function exportXlsx() {
    const rows = [
      [
        "código",
        "tipo",
        "marca",
        "modelo",
        "serial",
        "data de compra",
        "telefone 1",
        "telefone 2",
        "imei 1",
        "imei 2",
        "operadora",
        "categoria",
        "localização",
        "status",
        "funcionário atual",
        "valor",
      ],
      ...exportRows(),
    ];

    const sheet = XLSX.utils.aoa_to_sheet(rows);
    formatWorksheet(sheet, rows);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Ativos");
    const buffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
      cellStyles: true,
    });

    downloadBlob(
      exportFileName(),
      new Blob([buffer], {
        type: XLSX_MIME_TYPE,
      }),
    );
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

  const deleteModalActiveAssignment = assetPendingDelete
    ? activeAssignmentByAssetId.get(assetPendingDelete.id) ?? null
    : null;
  const deleteModalHasLinkedRecords = Boolean(
    deleteImpact &&
      (deleteImpact.historyCount > 0 || deleteImpact.attachmentCount > 0),
  );

  return (
    <AppShell
      current="assets"
      title="Ativos"
      subtitle="Consulta principal de ativos, com criação, atribuições e histórico disponíveis na mesma tela."
      contentSize="wide"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {showBackToLocations ? (
            <Link href="/locations" className="btn-secondary px-4 py-2.5 text-sm">
              ← Voltar para Localizações
            </Link>
          ) : null}
          {canExportAssets ? (
            <button
              type="button"
              onClick={exportXlsx}
              disabled={loading || redirecting || Boolean(error) || sortedAssets.length === 0}
              className="btn-secondary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              Exportar XLSX
            </button>
          ) : null}

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
                void reloadAssetData();
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

          <section className="overflow-visible rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
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
                          <td className="cell-strong">{asset.internalCode}</td>
                          <td>{labelType(asset.type)}</td>
                          <td>{asset.brand}</td>
                          <td>{asset.model ?? "-"}</td>
                          <td>{asset.serialNumber ?? "-"}</td>
                          <td>
                            <span className={statusBadgeClass(asset.status)}>
                              {labelStatus(asset.status)}
                            </span>
                          </td>
                          <td>{assetCategoryName(asset, categories)}</td>
                          <td>{assetLocationName(asset, locations)}</td>
                          <td className="text-right">{moneyBRL(asset.valueCents)}</td>
                          <td className="asset-actions-column">
                            <div className="asset-actions-menu">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionsMenuAssetId((current) =>
                                    current === asset.id ? null : asset.id,
                                  )
                                }
                                className="action-button asset-actions-menu-trigger"
                                aria-expanded={openActionsMenuAssetId === asset.id}
                                aria-haspopup="menu"
                                aria-label={`Abrir ações do ativo ${asset.internalCode}`}
                              >
                                <ActionMenuIcon />
                                Ações
                              </button>

                              {openActionsMenuAssetId === asset.id ? (
                                <div
                                  ref={actionsMenuRef}
                                  className="asset-actions-menu-panel"
                                  role="menu"
                                  aria-label={`Ações do ativo ${asset.internalCode}`}
                                >
                                  {canManageAssetActions ? (
                                    <>
                                      {activeAssignmentByAssetId.has(asset.id) ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOpenActionsMenuAssetId(null);
                                            void handleReturnAsset(asset);
                                          }}
                                          disabled={returningAssetId === asset.id}
                                          className="action-button asset-actions-menu-item disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {returningAssetId === asset.id
                                            ? "Devolvendo..."
                                            : "Devolver"}
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedAssetForAssign(asset);
                                            setOpenActionsMenuAssetId(null);
                                          }}
                                          className="action-button asset-actions-menu-item"
                                        >
                                          Atribuir
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedAssetForEdit(asset);
                                          setOpenActionsMenuAssetId(null);
                                        }}
                                        className="action-button asset-actions-menu-item"
                                      >
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionsMenuAssetId(null);
                                          openDeleteModal(asset);
                                        }}
                                        className="action-button asset-actions-menu-item"
                                      >
                                        Excluir
                                      </button>
                                    </>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAssetForHistory(asset);
                                      setOpenActionsMenuAssetId(null);
                                    }}
                                    className="action-button asset-actions-menu-item"
                                  >
                                    Historico
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAssetForQr(asset);
                                      setOpenActionsMenuAssetId(null);
                                    }}
                                    className="action-button asset-actions-menu-item"
                                  >
                                    QR Code
                                  </button>
                                  <Link
                                    href={`/assets/${asset.id}`}
                                    onClick={() => setOpenActionsMenuAssetId(null)}
                                    className="action-button asset-actions-menu-item"
                                  >
                                    Ver detalhes
                                  </Link>
                                </div>
                              ) : null}
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

            {selectedAssetForAssign ? (
              <AssignAssetModal
                asset={selectedAssetForAssign}
                open={Boolean(selectedAssetForAssign)}
                hideTrigger
                onOpenChange={(open) => {
                  if (!open) {
                    setSelectedAssetForAssign(null);
                  }
                }}
                onAssigned={() => {
                  setAssignmentRefreshKey((current) => current + 1);
                  setHistoryRefreshKey((current) => current + 1);
                  void reloadAssetData();
                }}
              />
            ) : null}

            {selectedAssetForEdit ? (
              <EditAssetModal
                asset={selectedAssetForEdit}
                open={Boolean(selectedAssetForEdit)}
                hideTrigger
                categories={categories}
                locations={locations}
                onOpenChange={(open) => {
                  if (!open) {
                    setSelectedAssetForEdit(null);
                  }
                }}
                onUpdated={(updatedAsset) => {
                  setAssets((current) =>
                    current.map((item) =>
                      item.id === updatedAsset.id ? updatedAsset : item,
                    ),
                  );
                  setError(null);
                  setHistoryRefreshKey((current) => current + 1);
                  void reloadAssetData();
                }}
              />
            ) : null}

            {selectedAssetForHistory ? (
              <AssetHistoryModal
                asset={selectedAssetForHistory}
                refreshKey={historyRefreshKey}
                open={Boolean(selectedAssetForHistory)}
                hideTrigger
                onOpenChange={(open) => {
                  if (!open) {
                    setSelectedAssetForHistory(null);
                  }
                }}
              />
            ) : null}

            {selectedAssetForQr ? (
              <AssetQrCodeModal
                asset={selectedAssetForQr}
                open={Boolean(selectedAssetForQr)}
                hideTrigger
                onOpenChange={(open) => {
                  if (!open) {
                    setSelectedAssetForQr(null);
                  }
                }}
              />
            ) : null}

            {assetPendingDelete ? (
              <div className="fixed inset-0 z-[99999]" onClick={closeDeleteModal}>
                <div className="absolute inset-0 bg-[rgba(23,58,67,0.66)] backdrop-blur-[3px]" />

                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <div
                    className="glass-panel w-full max-w-lg overflow-hidden rounded-[30px]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b px-6 py-5 [border-color:var(--border-soft)]">
                      <div>
                        <p className="eyebrow">Exclusão</p>
                        <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                          Excluir ativo
                        </h2>
                        <p className="mt-1 text-sm [color:var(--text-secondary)]">
                          {assetPendingDelete.internalCode}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={closeDeleteModal}
                        disabled={deleteLoading || returningDeleteAsset}
                        className="btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                      >
                        Fechar
                      </button>
                    </div>

                    <div className="space-y-4 px-6 py-5">
                      <div className="surface-soft rounded-[24px] px-4 py-4">
                        <div className="font-semibold [color:var(--text-primary)]">
                          {assetPendingDelete.brand}{" "}
                          {assetPendingDelete.model ?? ""}
                        </div>
                        <div className="mt-1 text-sm [color:var(--text-secondary)]">
                          {labelType(assetPendingDelete.type)} |{" "}
                          {assetPendingDelete.serialNumber ?? "Sem serial"}
                        </div>
                      </div>

                      <div className="text-sm [color:var(--text-secondary)]">
                        Confirme para remover este ativo do inventário. Essa ação não
                        pode ser desfeita.
                      </div>

                      <div className="status-banner-warning rounded-[22px] px-4 py-3 text-sm">
                        Alternativa: altere o status para Baixado para manter o
                        registro no inventário.
                      </div>

                      {deleteImpactLoading ? (
                        <div className="surface-soft rounded-[22px] px-4 py-3 text-sm [color:var(--text-secondary)]">
                          Verificando histórico e anexos...
                        </div>
                      ) : deleteModalHasLinkedRecords && deleteImpact ? (
                        <div className="status-banner-warning rounded-[22px] px-4 py-3 text-sm">
                          Este ativo possui {deleteImpact.historyCount} histórico(s)
                          de atribuição e {deleteImpact.attachmentCount} anexo(s).
                          Eles serão removidos junto com o ativo.
                        </div>
                      ) : null}

                      {deleteInfo ? (
                        <div className="status-banner-warning rounded-[22px] px-4 py-3 text-sm">
                          {deleteInfo}
                        </div>
                      ) : null}

                      {deleteError ? (
                        <div className="status-banner-warning whitespace-pre-line rounded-[22px] px-4 py-3 text-sm">
                          {deleteError}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2 border-t px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-end">
                      <button
                        type="button"
                        onClick={closeDeleteModal}
                        disabled={deleteLoading || returningDeleteAsset}
                        className="btn-secondary px-4 py-3 text-sm disabled:opacity-50"
                      >
                        Fechar
                      </button>

                      {deleteModalActiveAssignment ? (
                        <button
                          type="button"
                          onClick={handleReturnFromDeleteModal}
                          disabled={deleteLoading || returningDeleteAsset}
                          className="btn-secondary px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {returningDeleteAsset
                            ? "Devolvendo..."
                            : "Devolver ativo"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={handleConfirmDeleteAsset}
                        disabled={deleteLoading || returningDeleteAsset || deleteImpactLoading}
                        className="btn-danger px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {deleteLoading ? "Excluindo..." : "Excluir"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
    </AppShell>
  );
}
