"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAssets, getEmployeesList, getLocations } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { Asset, Employee, Location } from "@/lib/types";

type SearchData = {
  assets: Asset[];
  employees: Employee[];
  locations: Location[];
};

type SearchItem =
  | {
      kind: "asset";
      id: string;
      title: string;
      subtitle: string;
      href: string;
      score: number;
    }
  | {
      kind: "employee";
      id: string;
      title: string;
      subtitle: string;
      href: string;
      score: number;
    }
  | {
      kind: "location";
      id: string;
      title: string;
      subtitle: string;
      href: string;
      score: number;
    };

function isValidId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function scoreMatch(text: string, query: string) {
  const normalizedText = normalizeText(text);
  const normalizedQuery = normalizeText(query);

  if (normalizedText.startsWith(normalizedQuery)) {
    return 0;
  }

  if (normalizedText.includes(normalizedQuery)) {
    return 1;
  }

  return 2;
}

function formatCurrency(valueCents?: number | null) {
  if (valueCents == null) return "-";

  return (valueCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    EM_USO: "Em uso",
    ESTOQUE: "Estoque",
    MANUTENCAO: "Manutenção",
    BAIXADO: "Baixado",
  };

  return labels[status] ?? status;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function GlobalSearch() {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setFocused(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFocused(false);
        setQuery("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setLoading(false);
      setError(null);
      setData(null);
      return;
    }

    const requestId = ++requestIdRef.current;

    async function loadData() {
      const token = getAuthToken();

      if (!token) {
        clearAuthToken();
        setLoading(false);
        setError("Sessao expirada. Faca login novamente.");
        router.replace("/login");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [assets, employees, locations] = await Promise.all([
          getAssets(token),
          getEmployeesList(token, "all"),
          getLocations(token),
        ]);

        if (requestId !== requestIdRef.current) return;

        setData({ assets, employees, locations });
      } catch (err: unknown) {
        if (requestId !== requestIdRef.current) return;

        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar a busca global.";
        setError(message);
        setData(null);
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    loadData();
  }, [debouncedQuery, router]);

  const results = useMemo(() => {
    if (debouncedQuery.length < 2 || !data) {
      return {
        assets: [] as SearchItem[],
        employees: [] as SearchItem[],
        locations: [] as SearchItem[],
      };
    }

    const queryText = debouncedQuery;

    const assetResults = data.assets
      .map<SearchItem | null>((asset) => {
        const text = [
          asset.internalCode,
          asset.serialNumber ?? "",
          asset.brand,
          asset.model ?? "",
        ].join(" ");

        if (!normalizeText(text).includes(normalizeText(queryText))) {
          return null;
        }

        return {
          kind: "asset",
          id: asset.id,
          title: `${asset.internalCode} • ${asset.brand}${asset.model ? ` ${asset.model}` : ""}`,
            subtitle: [
              asset.serialNumber ? `Serial: ${asset.serialNumber}` : "",
              asset.location?.name ? `Localização: ${asset.location.name}` : "",
              asset.category?.name ? `Categoria: ${asset.category.name}` : "",
            `Status: ${statusLabel(asset.status)}`,
            asset.valueCents != null ? formatCurrency(asset.valueCents) : "",
          ]
            .filter(Boolean)
            .join(" • "),
          href: `/assets/${asset.id}`,
          score: scoreMatch(text, queryText),
        };
      })
      .filter((item): item is SearchItem => Boolean(item))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    const employeeResults = data.employees
      .map<SearchItem | null>((employee) => {
        if (!isValidId(employee.id)) {
          return null;
        }

        const text = [employee.name, employee.email, employee.department ?? "", employee.position ?? ""].join(" ");

        if (!normalizeText(text).includes(normalizeText(queryText))) {
          return null;
        }

        return {
          kind: "employee",
          id: employee.id,
          title: employee.name,
          subtitle: [employee.email, employee.department ?? "", employee.position ?? ""]
            .filter(Boolean)
            .join(" • "),
          href: `/employees/${employee.id}`,
          score: scoreMatch(text, queryText),
        };
      })
      .filter((item): item is SearchItem => Boolean(item))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    const locationResults = data.locations
      .map<SearchItem | null>((location) => {
        if (!isValidId(location.id)) {
          return null;
        }

        const text = [location.name, location.description ?? ""].join(" ");

        if (!normalizeText(text).includes(normalizeText(queryText))) {
          return null;
        }

        return {
          kind: "location",
          id: location.id,
          title: location.name,
          subtitle: location.description ?? "Localização cadastrada",
          href: `/assets?locationId=${encodeURIComponent(location.id)}`,
          score: scoreMatch(text, queryText),
        };
      })
      .filter((item): item is SearchItem => Boolean(item))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    return {
      assets: assetResults,
      employees: employeeResults,
      locations: locationResults,
    };
  }, [data, debouncedQuery]);

  const hasQuery = debouncedQuery.length >= 2;
  const totalResults =
    results.assets.length + results.employees.length + results.locations.length;
  const open = focused && query.trim().length > 0;

  return (
    <div ref={wrapperRef} className="global-search-shell">
      <label className="flex min-h-[3rem] items-center gap-2 rounded-[1.1rem] border border-[var(--border-soft)] bg-[var(--surface-card)] px-3.5 shadow-[0_10px_30px_rgba(23,58,67,0.08)] transition focus-within:border-[var(--brand-teal-700)]">
        <SearchIcon />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Buscar ativos, funcionários ou localizações"
          className="w-full border-0 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        {loading ? <Spinner /> : null}
      </label>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[24px] border bg-[var(--surface-card)] shadow-[0_26px_70px_rgba(23,58,67,0.18)] [border-color:var(--border-soft)]">
          <div className="border-b px-4 py-3 [border-color:var(--border-soft)]">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold [color:var(--text-primary)]">
                Busca global
              </div>
              <div className="status-pill">
                {loading
                  ? "Buscando..."
                  : hasQuery
                    ? `${totalResults} resultado(s)`
                    : "Digite 2 caracteres"}
              </div>
            </div>
            <div className="mt-1 text-xs [color:var(--text-secondary)]">
              Encontre ativos, funcionários e localizações rapidamente.
            </div>
          </div>

          {error ? (
            <div className="status-banner-error m-4 rounded-[20px] px-4 py-3 text-sm">
              {error}
            </div>
          ) : !hasQuery ? (
            <div className="px-4 py-8 text-sm [color:var(--text-secondary)]">
              Digite ao menos 2 caracteres para pesquisar.
            </div>
          ) : totalResults === 0 ? (
            <div className="px-4 py-8 text-sm [color:var(--text-secondary)]">
              Nenhum resultado encontrado.
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto p-2">
              {(
                [
                  ["Ativos", results.assets],
                  ["Funcionários", results.employees],
                  ["Localizações", results.locations],
                ] as const
              ).map(([label, items]) =>
                items.length > 0 ? (
                  <section key={label} className="mb-2 last:mb-0">
                    <div className="px-3 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] [color:var(--text-muted)]">
                      {label}
                    </div>
                    <div className="space-y-1">
                      {items.map((item) => (
                        <Link
                          key={`${item.kind}-${item.id}`}
                          href={item.href}
                          className="block rounded-[18px] px-3 py-3 transition hover:bg-[rgba(44,100,112,0.08)]"
                          onClick={(event) => {
                            if (item.kind === "location" && !item.id) {
                              event.preventDefault();
                              setError(
                                "Localização inválida. Não foi possível abrir os ativos.",
                              );
                              return;
                            }

                            setFocused(false);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold [color:var(--text-primary)]">
                                {item.title}
                              </div>
                              <div className="mt-1 line-clamp-2 text-xs leading-5 [color:var(--text-secondary)]">
                                {item.subtitle}
                              </div>
                            </div>
                            <span className="status-pill shrink-0">
                              Abrir
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null,
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
