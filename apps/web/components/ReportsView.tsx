"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveAssignments, getAssets, getEmployees } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
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
  { value: "OUTRO", label: "Outro" },
];

const STATUS_OPTIONS: { value: AssetStatus; label: string; color: string }[] = [
  { value: "ESTOQUE", label: "Estoque", color: "#2c6470" },
  { value: "EM_USO", label: "Em uso", color: "#d77967" },
  { value: "MANUTENCAO", label: "Manutencao", color: "#9f735f" },
  { value: "BAIXADO", label: "Baixado", color: "#748c94" },
];

const BAR_COLORS = ["#2c6470", "#d77967", "#173a43", "#9f735f", "#748c94"];

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

function incrementGroup(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function groupToItems(map: Map<string, number>) {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null || value === "" ? "-" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
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

    return assets.filter((asset) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          asset.internalCode,
          asset.brand,
          asset.model ?? "",
          asset.serialNumber ?? "",
        ].some((value) => value.toLowerCase().includes(normalizedSearch));

      return (
        matchesSearch &&
        (!statusFilter || asset.status === statusFilter) &&
        (!typeFilter || asset.type === typeFilter) &&
        (!categoryFilter || categoryName(asset) === categoryFilter) &&
        (!locationFilter || locationName(asset) === locationFilter)
      );
    });
  }, [assets, categoryFilter, locationFilter, search, statusFilter, typeFilter]);

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

    return {
      total: filteredAssets.length,
      assigned,
      available,
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
      locationFilter,
  );

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
    setCategoryFilter("");
    setLocationFilter("");
  }

  function exportFilteredAssets() {
    const rows = [
      [
        "codigo",
        "tipo",
        "marca",
        "modelo",
        "status",
        "categoria",
        "localização",
      ],
      ...filteredAssets.map((asset) => [
        asset.internalCode,
        labelType(asset.type),
        asset.brand,
        asset.model ?? "",
        labelStatus(asset.status),
        categoryName(asset),
        locationName(asset),
      ]),
    ];

    downloadCsv("assets-filtrados.csv", rows);
  }

  const cards = [
    { label: "Total de ativos", value: report.total },
    { label: "Ativos atribuidos", value: report.assigned },
    { label: "Ativos disponiveis", value: report.available },
    { label: "Funcionarios", value: employees.length },
  ];

  return (
    <AppShell
      current="reports"
      title="Relatorios"
      subtitle="Indicadores operacionais do inventario e exportacao dos ativos filtrados."
      contentSize="wide"
      actions={
        <button
          type="button"
          onClick={exportFilteredAssets}
          disabled={loading || redirecting || Boolean(error) || filteredAssets.length === 0}
          className="btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
        >
          Exportar CSV
        </button>
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

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(14rem,1.35fr)_repeat(4,minmax(9rem,1fr))]">
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
                <div className="mt-3 text-4xl font-semibold tracking-[-0.05em] [color:var(--text-primary)]">
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
                  Exportacao
                </h2>
                <p className="mt-1 text-sm [color:var(--text-secondary)]">
                  O CSV usa a selecao filtrada atual.
                </p>
              </div>
              <div className="space-y-3 text-sm [color:var(--text-secondary)]">
                <div className="flex justify-between gap-4">
                  <span>Assets no arquivo</span>
                  <strong className="[color:var(--text-primary)]">
                    {filteredAssets.length}
                  </strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Assignments ativos</span>
                  <strong className="[color:var(--text-primary)]">
                    {assignments.length}
                  </strong>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Funcionarios carregados</span>
                  <strong className="[color:var(--text-primary)]">
                    {employees.length}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={exportFilteredAssets}
                disabled={loading || filteredAssets.length === 0}
                className="btn-primary mt-6 w-full px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
              >
                Exportar assets filtrados
              </button>
            </article>
          </section>
        </>
      )}
    </AppShell>
  );
}
