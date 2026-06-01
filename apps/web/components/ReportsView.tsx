"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveAssignments, getAssets, getEmployees } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { useAuth } from "./AuthProvider";
import { canExportReports } from "@/lib/permissions";
import * as XLSX from "xlsx";
import type {
  Asset,
  AssetStatus,
  AssetType,
  Assignment,
  Employee,
} from "@/lib/types";
import AppShell from "./AppShell";

const TYPE_OPTIONS: { value: AssetType; label: string }[] = [
  { value: "DESKTOP", label: "Desktop" },
  { value: "NOTEBOOK", label: "Notebook" },
  { value: "MONITOR", label: "Monitor" },
  { value: "MOUSE", label: "Mouse" },
  { value: "TECLADO", label: "Teclado" },
  { value: "SMARTPHONE", label: "Smartphone" },
  { value: "OUTRO", label: "Outro" },
];

const STATUS_OPTIONS: { value: AssetStatus; label: string; color: string }[] = [
  { value: "ESTOQUE", label: "Estoque", color: "#2c6470" },
  { value: "EM_USO", label: "Em uso", color: "#d77967" },
  { value: "MANUTENCAO", label: "Manutencao", color: "#9f735f" },
  { value: "BAIXADO", label: "Baixado", color: "#748c94" },
];

const BAR_COLORS = ["#2c6470", "#d77967", "#173a43", "#9f735f", "#748c94"];
const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

type GroupItem = {
  label: string;
  value: number;
};

function labelType(type: AssetType) {
  return TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type;
}

function labelStatus(status: AssetStatus) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

function categoryName(asset: Asset) {
  return asset.category?.name ?? "Sem categoria";
}

function locationName(asset: Asset) {
  return asset.location?.name ?? "Sem localização";
}

function formatMoney(valueCents: number) {
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

function parseDateFilter(value: string, endOfDay = false) {
  if (!value) return null;

  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function assetPurchaseDate(asset: Asset) {
  if (!asset.purchaseDate) return null;

  const parsed = new Date(asset.purchaseDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function incrementGroup(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function groupToItems(map: Map<string, number>) {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
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

function formatWorksheet(sheet: XLSX.WorkSheet, rows: string[][]) {
  const columnCount = Math.max(...rows.map((row) => row.length), 1);

  sheet["!cols"] = Array.from({ length: columnCount }, (_, columnIndex) => {
    const width = rows.reduce((max, row) => {
      const cellLength = String(row[columnIndex] ?? "").length;
      return Math.max(max, cellLength);
    }, 0);

    return { wch: Math.min(Math.max(width + 2, 12), 42) };
  });

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: columnIndex });
    const cell = sheet[cellAddress];
    if (cell) {
      cell.s = { font: { bold: true } };
    }
  }
}

function downloadXlsx(filename: string, rows: string[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  formatWorksheet(sheet, rows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Ativos");
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    cellStyles: true,
  });
  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function PieChart({
  items,
  total,
}: {
  items: Array<GroupItem & { color: string }>;
  total: number;
}) {
  let current = 0;
  const segments = items
    .filter((item) => item.value > 0)
    .map((item) => {
      const start = current;
      const size = (item.value / Math.max(total, 1)) * 100;
      current += size;
      return `${item.color} ${start}% ${current}%`;
    });

  const background =
    total > 0
      ? `conic-gradient(${segments.join(", ")})`
      : "conic-gradient(rgba(23,58,67,0.12) 0% 100%)";

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center">
      <div
        className="h-48 w-48 shrink-0 rounded-full border-[18px] border-white/70 shadow-[inset_0_0_0_1px_rgba(23,58,67,0.08),0_18px_50px_rgba(23,58,67,0.10)]"
        style={{ background }}
        aria-label="Grafico de pizza por status"
      />
      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-sm [color:var(--text-secondary)]">
                {item.label}
              </span>
            </div>
            <span className="text-sm font-semibold [color:var(--text-primary)]">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ items }: { items: GroupItem[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  if (items.length === 0) {
    return (
      <div className="px-1 py-8 text-sm [color:var(--text-secondary)]">
        Nenhum dado disponivel.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium [color:var(--text-primary)]">
              {item.label}
            </span>
            <span className="text-sm font-semibold [color:var(--text-secondary)]">
              {item.value}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[rgba(23,58,67,0.08)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((item.value / max) * 100, 5)}%`,
                backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReportsView() {
  const router = useRouter();
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const canExportData = canExportReports(user?.role);

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
        const [assetsData, assignmentsData, employeesData] = await Promise.all([
          getAssets(token),
          getActiveAssignments(token),
          getEmployees(token),
        ]);

        setAssets(assetsData);
        setAssignments(assignmentsData);
        setEmployees(employeesData);
        setError(null);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar os relatorios.";

        handleAuthError(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  const categoryOptions = useMemo(
    () =>
      [...new Set(assets.map(categoryName))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [assets],
  );

  const locationOptions = useMemo(
    () =>
      [...new Set(assets.map(locationName))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [assets],
  );

  const filteredAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const startDate = parseDateFilter(dateFrom);
    const endDate = parseDateFilter(dateTo, true);
    const hasPeriodFilter = Boolean(startDate || endDate);

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
      const purchaseDate = assetPurchaseDate(asset);
      const matchesPeriod =
        !hasPeriodFilter ||
        (purchaseDate !== null &&
          (!startDate || purchaseDate >= startDate) &&
          (!endDate || purchaseDate <= endDate));

      return (
        matchesSearch &&
        matchesPeriod &&
        (!statusFilter || asset.status === statusFilter) &&
        (!typeFilter || asset.type === typeFilter) &&
        (!categoryFilter || categoryName(asset) === categoryFilter) &&
        (!locationFilter || locationName(asset) === locationFilter)
      );
    });
  }, [assets, categoryFilter, dateFrom, dateTo, locationFilter, search, statusFilter, typeFilter]);

  const report = useMemo(() => {
    const assignedAssetIds = new Set(assignments.map((item) => item.assetId));
    const byStatus = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byLocation = new Map<string, number>();

    for (const asset of filteredAssets) {
      incrementGroup(byStatus, labelStatus(asset.status));
      incrementGroup(byCategory, categoryName(asset));
      incrementGroup(byLocation, locationName(asset));
    }

    const assigned = filteredAssets.filter((asset) =>
      assignedAssetIds.has(asset.id),
    ).length;
    const available = filteredAssets.filter(
      (asset) => asset.status === "ESTOQUE" && !assignedAssetIds.has(asset.id),
    ).length;
    const totalValueCents = filteredAssets.reduce(
      (sum, asset) => sum + (asset.valueCents ?? 0),
      0,
    );
    const assetsWithValue = filteredAssets.filter(
      (asset) => asset.valueCents != null,
    ).length;
    const averageValueCents = assetsWithValue > 0
      ? Math.round(totalValueCents / assetsWithValue)
      : 0;

    return {
      total: filteredAssets.length,
      assigned,
      available,
      totalValueCents,
      averageValueCents,
      byStatus: STATUS_OPTIONS.map((status) => ({
        label: status.label,
        value: byStatus.get(status.label) ?? 0,
        color: status.color,
      })),
      byCategory: groupToItems(byCategory),
      byLocation: groupToItems(byLocation),
    };
  }, [assignments, filteredAssets]);

  const hasFilters = Boolean(
    search.trim() ||
      statusFilter ||
      typeFilter ||
      categoryFilter ||
      locationFilter ||
      dateFrom ||
      dateTo,
  );

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setCategoryFilter("");
    setLocationFilter("");
    setDateFrom("");
    setDateTo("");
  }

  function exportFilteredAssets() {
    const periodLabel = [
      dateFrom ? formatDate(`${dateFrom}T00:00:00`) : "sem início",
      dateTo ? formatDate(`${dateTo}T00:00:00`) : "sem fim",
    ].join(" a ");
    const rows = [
      ["Relatório financeiro de ativos"],
      ["Período", periodLabel],
      ["Total de ativos", String(report.total)],
      ["Valor total", formatMoney(report.totalValueCents)],
      ["Valor médio", formatMoney(report.averageValueCents)],
      [],
      ["Quantidade por categoria"],
      ["categoria", "quantidade"],
      ...report.byCategory.map((item) => [item.label, String(item.value)]),
      [],
      [
        "código",
        "tipo",
        "marca",
        "modelo",
        "status",
        "categoria",
        "localização",
        "data de compra",
        "valor",
      ],
      ...filteredAssets.map((asset) => [
        asset.internalCode,
        labelType(asset.type),
        asset.brand,
        asset.model ?? "",
        labelStatus(asset.status),
        categoryName(asset),
        locationName(asset),
        formatDate(asset.purchaseDate),
        asset.valueCents == null ? "" : formatMoney(asset.valueCents),
      ]),
    ];

    downloadXlsx(
      `relatorio-financeiro-ativos-${formatFileTimestamp()}.xlsx`,
      rows,
    );
  }

  const cards = [
    { label: "Total de ativos", value: report.total },
    { label: "Valor total", value: formatMoney(report.totalValueCents) },
    { label: "Valor médio", value: formatMoney(report.averageValueCents) },
    { label: "Categorias", value: report.byCategory.length },
  ];

  return (
    <AppShell
      current="reports"
      title="Relatórios"
      subtitle="Indicadores financeiros por data de compra e exportação dos ativos filtrados."
      contentSize="wide"
      actions={
        canExportData ? (
          <button
            type="button"
            onClick={exportFilteredAssets}
            disabled={loading || redirecting || Boolean(error) || filteredAssets.length === 0}
            className="btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
          >
            Exportar XLSX
          </button>
        ) : null
      }
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
          <section className="overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
            <div className="flex flex-col gap-3 border-b px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
              <div className="status-pill">
                {loading
                  ? "Carregando..."
                  : `${filteredAssets.length} de ${assets.length} ativo(s)`}
              </div>
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="btn-secondary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Limpar filtros
              </button>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Buscar
                </span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  disabled={loading}
                  className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
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
                  disabled={loading}
                  className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
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
                  disabled={loading}
                  className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
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
                  disabled={loading}
                  className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="">Todas</option>
                  {categoryOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
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
                  disabled={loading}
                  className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="">Todas</option>
                  {locationOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Data inicial
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  disabled={loading}
                  className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Data final
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  disabled={loading}
                  className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </label>
            </div>
          </section>

          <section className="metrics-grid">
            {cards.map((card, index) => (
              <article key={card.label} className="stat-card">
                <div
                  className="mb-5 h-2.5 w-16 rounded-full"
                  style={{ backgroundColor: BAR_COLORS[index % BAR_COLORS.length] }}
                />
                <div className="text-sm [color:var(--text-secondary)]">
                  {card.label}
                </div>
                <div className="mt-3 break-words text-3xl font-semibold [color:var(--text-primary)]">
                  {loading ? "..." : card.value}
                </div>
              </article>
            ))}
          </section>

          <section className="grid gap-6 2xl:grid-cols-[0.9fr_1.1fr]">
            <article className="surface-card rounded-[30px] p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold [color:var(--text-primary)]">
                  Ativos por status
                </h2>
                <p className="mt-1 text-sm [color:var(--text-secondary)]">
                  Distribuicao dos ativos filtrados.
                </p>
              </div>
              {loading ? (
                <div className="py-8 text-sm [color:var(--text-secondary)]">
                  Carregando grafico...
                </div>
              ) : (
                <PieChart items={report.byStatus} total={report.total} />
              )}
            </article>

            <article className="surface-card rounded-[30px] p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold [color:var(--text-primary)]">
                  Ativos por categoria
                </h2>
                <p className="mt-1 text-sm [color:var(--text-secondary)]">
                  Volume por categoria cadastrada.
                </p>
              </div>
              {loading ? (
                <div className="py-8 text-sm [color:var(--text-secondary)]">
                  Carregando categorias...
                </div>
              ) : (
                <BarChart items={report.byCategory} />
              )}
            </article>
          </section>

          <section className="grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
            <article className="surface-card rounded-[30px] p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold [color:var(--text-primary)]">
                  Ativos por localização
                </h2>
                <p className="mt-1 text-sm [color:var(--text-secondary)]">
                  Distribuicao fisica dos ativos filtrados.
                </p>
              </div>
              {loading ? (
                <div className="py-8 text-sm [color:var(--text-secondary)]">
                  Carregando localizações...
                </div>
              ) : (
                <BarChart items={report.byLocation} />
              )}
            </article>

            <article className="surface-card rounded-[30px] p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold [color:var(--text-primary)]">
                  Exportação
                </h2>
                <p className="mt-1 text-sm [color:var(--text-secondary)]">
                  A planilha XLSX usa o período e os filtros atuais.
                </p>
              </div>
              <div className="space-y-3 text-sm [color:var(--text-secondary)]">
                <div className="flex justify-between gap-4">
                  <span>Ativos no arquivo</span>
                  <strong className="[color:var(--text-primary)]">
                    {filteredAssets.length}
                  </strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Atribuições ativas</span>
                  <strong className="[color:var(--text-primary)]">
                    {assignments.length}
                  </strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Funcionários carregados</span>
                  <strong className="[color:var(--text-primary)]">
                    {employees.length}
                  </strong>
                </div>
              </div>
              {canExportData ? (
                <button
                  type="button"
                  onClick={exportFilteredAssets}
                  disabled={loading || filteredAssets.length === 0}
                  className="btn-primary mt-6 w-full px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Exportar ativos filtrados
                </button>
              ) : null}
            </article>
          </section>
        </>
      )}
    </AppShell>
  );
}
