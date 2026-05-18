"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  createAssignment,
  getActiveAssignments,
  getAssets,
  getEmployeeAssignments,
  returnAssignment,
} from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { canManageAssignments } from "@/lib/permissions";
import type { Asset, Assignment, Employee } from "@/lib/types";
import { useAuth } from "./AuthProvider";

type FilterState = {
  search: string;
  categoryId: string;
  locationId: string;
};

const TYPE_LABELS: Record<string, string> = {
  DESKTOP: "Desktop",
  NOTEBOOK: "Notebook",
  MONITOR: "Monitor",
  MOUSE: "Mouse",
  TECLADO: "Teclado",
  OUTRO: "Outro",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function assetTitle(asset?: Asset | null) {
  if (!asset) return "-";
  return [asset.internalCode, asset.brand, asset.model].filter(Boolean).join(" - ");
}

function typeLabel(value?: string | null) {
  if (!value) return "-";
  return TYPE_LABELS[value] ?? value;
}

function EmployeeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
      <path d="M4 21a8 8 0 1 1 16 0" />
    </svg>
  );
}

export default function EmployeeAssignmentsModal({
  employee,
}: {
  employee: Employee;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  const [assignPanelOpen, setAssignPanelOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    categoryId: "",
    locationId: "",
  });

  function handleAuthError(err: unknown) {
    if (
      err instanceof Error &&
      "status" in err &&
      typeof err.status === "number" &&
      err.status === 401
    ) {
      toast.error("Sessao expirada. Faca login novamente.");
      return true;
    }

    return false;
  }

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let active = true;

    async function loadData() {
      const token = getAuthToken();

      if (!token) {
        if (!active) return;
        setError("Sessao expirada. Faca login novamente.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [employeeAssignments, allAssets, activeAssignmentsData] =
          await Promise.all([
            getEmployeeAssignments(employee.id, token),
            getAssets(token),
            getActiveAssignments(token),
          ]);

        if (!active) return;

        setAssignments(employeeAssignments);
        setAssets(allAssets);
        setActiveAssignments(activeAssignmentsData);
      } catch (err: unknown) {
        if (!active) return;

        if (handleAuthError(err)) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar os dados do funcionario.";

        setError(message);
        setAssignments([]);
        setAssets([]);
        setActiveAssignments([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [employee.id, open]);

  const activeEmployeeAssignments = useMemo(
    () => assignments.filter((assignment) => !assignment.returnedAt),
    [assignments],
  );
  const historyAssignments = useMemo(
    () => assignments.filter((assignment) => Boolean(assignment.returnedAt)),
    [assignments],
  );

  const activeAssetIds = useMemo(
    () => new Set(activeAssignments.map((assignment) => assignment.assetId)),
    [activeAssignments],
  );

  const availableAssets = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    return assets.filter((asset) => {
      const isStock = asset.status === "ESTOQUE";
      const isFree = !activeAssetIds.has(asset.id);
      const matchesSearch =
        !normalizedSearch ||
        [
          asset.internalCode,
          asset.brand,
          asset.model ?? "",
          asset.serialNumber ?? "",
        ].some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesCategory =
        !filters.categoryId || (asset.category?.id ?? "") === filters.categoryId;
      const matchesLocation =
        !filters.locationId || (asset.location?.id ?? "") === filters.locationId;

      return (
        isStock &&
        isFree &&
        matchesSearch &&
        matchesCategory &&
        matchesLocation
      );
    });
  }, [activeAssetIds, assets, filters]);

  const categoryOptions = useMemo(() => {
    return Array.from(
      new Map(
        assets
          .map((asset) => asset.category)
          .filter((value): value is NonNullable<Asset["category"]> => Boolean(value))
          .map((item) => [item.id, item]),
      ).values(),
    ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [assets]);

  const locationOptions = useMemo(() => {
    return Array.from(
      new Map(
        assets
          .map((asset) => asset.location)
          .filter((value): value is NonNullable<Asset["location"]> => Boolean(value))
          .map((item) => [item.id, item]),
      ).values(),
    ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [assets]);

  const selectedAsset = useMemo(
    () => availableAssets.find((asset) => asset.id === selectedAssetId) ?? null,
    [availableAssets, selectedAssetId],
  );

  useEffect(() => {
    if (selectedAssetId && !selectedAsset) {
      setSelectedAssetId("");
      setAssignmentNotes("");
    }
  }, [selectedAsset, selectedAssetId]);

  function close() {
    if (!loading && !actionLoadingId) {
      setOpen(false);
      setAssignPanelOpen(false);
      setSelectedAssetId("");
      setAssignmentNotes("");
      setFilters({
        search: "",
        categoryId: "",
        locationId: "",
      });
    }
  }

  function resetAssignForm() {
    setSelectedAssetId("");
    setAssignmentNotes("");
  }

  async function reloadData() {
    const token = getAuthToken();
    if (!token) {
      toast.error("Sessao expirada. Faca login novamente.");
      return;
    }

    const [employeeAssignments, allAssets, activeAssignmentsData] =
      await Promise.all([
        getEmployeeAssignments(employee.id, token),
        getAssets(token),
        getActiveAssignments(token),
      ]);

    setAssignments(employeeAssignments);
    setAssets(allAssets);
    setActiveAssignments(activeAssignmentsData);
  }

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAssetId) {
      toast.error("Selecione um ativo para atribuir.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      toast.error("Sessao expirada. Faca login novamente.");
      return;
    }

    setActionLoadingId(selectedAssetId);
    setError(null);

    try {
      await createAssignment(
        {
          assetId: selectedAssetId,
          employeeId: employee.id,
          notes: assignmentNotes.trim() || null,
        },
        token,
      );

      toast.success("Ativo atribuido com sucesso.");
      resetAssignForm();
      await reloadData();
    } catch (err: unknown) {
      if (handleAuthError(err)) {
        return;
      }

      const message =
        err instanceof Error ? err.message : "Nao foi possivel atribuir o ativo.";
      setError(message);
      toast.error(message);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleReturn(assignmentId: string) {
    const confirmed = window.confirm(
      "Deseja devolver este ativo? O assignment sera encerrado.",
    );

    if (!confirmed) return;

    const token = getAuthToken();
    if (!token) {
      toast.error("Sessao expirada. Faca login novamente.");
      return;
    }

    setActionLoadingId(assignmentId);
    setError(null);

    try {
      await returnAssignment(assignmentId, {}, token);
      toast.success("Ativo devolvido com sucesso.");
      await reloadData();
    } catch (err: unknown) {
      if (handleAuthError(err)) {
        return;
      }

      const message =
        err instanceof Error ? err.message : "Nao foi possivel devolver o ativo.";
      setError(message);
      toast.error(message);
    } finally {
      setActionLoadingId(null);
    }
  }

  if (!canManageAssignments(user?.role)) {
    return null;
  }

  const modal = (
    <div className="fixed inset-0 z-[99999]" onClick={close}>
      <div className="absolute inset-0 bg-[rgba(23,58,67,0.66)] backdrop-blur-[3px]" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="glass-panel w-full max-w-6xl overflow-hidden rounded-[30px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-col gap-3 border-b px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Funcionario</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                {employee.name}
              </h2>
              <p className="mt-1 text-sm [color:var(--text-secondary)]">
                {employee.email}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAssignPanelOpen((current) => !current)}
                className="btn-primary px-4 py-2.5 text-sm"
              >
                {assignPanelOpen ? "Fechar atribuicao" : "+ Atribuir ativo"}
              </button>

              <button
                type="button"
                onClick={close}
                className="btn-secondary px-3 py-2 text-sm"
              >
                Fechar
              </button>
            </div>
          </div>

          <div className="max-h-[78vh] overflow-auto px-6 py-5">
            {error ? (
              <div className="status-banner-error rounded-[22px] px-4 py-3 text-sm">
                {error}
              </div>
            ) : loading ? (
              <div className="text-sm [color:var(--text-secondary)]">
                Carregando ativos do funcionario...
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <div className="status-pill">
                    {activeEmployeeAssignments.length} ativo(s)
                  </div>
                  <div className="status-pill">
                    {historyAssignments.length} no historico
                  </div>
                  <div className="status-pill">
                    {availableAssets.length} disponivel(is)
                  </div>
                </div>

                {assignPanelOpen ? (
                  <section className="employee-assignments-panel employee-assignments-section surface-soft rounded-[24px] p-4">
                    <div className="flex flex-col gap-3 border-b pb-4 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold [color:var(--text-primary)]">
                          Atribuir ativo
                        </h3>
                        <p className="mt-1 text-xs [color:var(--text-secondary)]">
                          Mostrando apenas ativos em estoque e sem atribuicao ativa.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <label className="block text-sm">
                          <span className="sr-only">Buscar</span>
                          <input
                            value={filters.search}
                            onChange={(event) =>
                              setFilters((current) => ({
                                ...current,
                                search: event.target.value,
                              }))
                            }
                            className="brand-input min-w-56"
                            placeholder="Codigo, marca, modelo ou serial"
                          />
                        </label>

                        <select
                          value={filters.categoryId}
                          onChange={(event) =>
                            setFilters((current) => ({
                              ...current,
                              categoryId: event.target.value,
                            }))
                          }
                          className="brand-input min-w-44"
                        >
                          <option value="">Todas as categorias</option>
                          {categoryOptions.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={filters.locationId}
                          onChange={(event) =>
                            setFilters((current) => ({
                              ...current,
                              locationId: event.target.value,
                            }))
                          }
                          className="brand-input min-w-44"
                        >
                          <option value="">Todas as localizacoes</option>
                          {locationOptions.map((location) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <form onSubmit={handleAssign}>
                  <div className="mt-4 overflow-auto">
                        {availableAssets.length === 0 ? (
                          <div className="text-sm [color:var(--text-secondary)]">
                            Nenhum ativo disponivel para atribuicao.
                          </div>
                        ) : (
                          <table className="data-table data-table-compact">
                            <thead>
                              <tr>
                                <th></th>
                                <th>Codigo</th>
                                <th>Tipo</th>
                                <th>Marca</th>
                                <th>Modelo</th>
                                <th>Serial</th>
                                <th>Categoria</th>
                                <th>Localizacao</th>
                              </tr>
                            </thead>
                            <tbody>
                              {availableAssets.map((asset) => (
                                <tr
                                  key={asset.id}
                                  className={
                                    selectedAssetId === asset.id
                                      ? "employee-assignment-selected"
                                      : ""
                                  }
                                >
                                  <td>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedAssetId(asset.id)}
                                      className="btn-secondary px-3 py-2 text-xs"
                                    >
                                      {selectedAssetId === asset.id
                                        ? "Selecionado"
                                        : "Selecionar"}
                                    </button>
                                  </td>
                                  <td className="cell-strong">{asset.internalCode}</td>
                                  <td>{typeLabel(asset.type)}</td>
                                  <td>{asset.brand}</td>
                                  <td>{asset.model ?? "-"}</td>
                                  <td>{asset.serialNumber ?? "-"}</td>
                                  <td>{asset.category?.name ?? "-"}</td>
                                  <td>{asset.location?.name ?? "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {selectedAsset ? (
                        <div className="employee-assignments-selected mt-4 surface-soft rounded-[24px] px-4 py-4">
                          <div className="font-semibold [color:var(--text-primary)]">
                            {assetTitle(selectedAsset)}
                          </div>
                          <div className="mt-2 text-sm [color:var(--text-secondary)]">
                            {selectedAsset.category?.name ?? "Sem categoria"} |{" "}
                            {selectedAsset.location?.name ?? "Sem localizacao"}
                          </div>

                          <label className="mt-4 block text-sm">
                            <span className="font-medium [color:var(--text-primary)]">
                              Observacoes
                            </span>
                            <textarea
                              value={assignmentNotes}
                              onChange={(event) => setAssignmentNotes(event.target.value)}
                              rows={3}
                              className="brand-input mt-1.5"
                              placeholder="Observacoes opcionais da atribuicao."
                            />
                          </label>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="submit"
                              disabled={Boolean(actionLoadingId)}
                              className="btn-primary px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {actionLoadingId === selectedAsset.id
                                ? "Atribuindo..."
                                : "Confirmar atribuicao"}
                            </button>

                            <button
                              type="button"
                              onClick={resetAssignForm}
                              className="btn-secondary px-4 py-3 text-sm"
                            >
                              Limpar selecao
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </form>
                  </section>
                ) : null}

                <section className="employee-assignments-panel employee-assignments-section surface-soft rounded-[24px] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold [color:var(--text-primary)]">
                      Ativos atuais
                    </h3>
                    <span className="text-xs [color:var(--text-secondary)]">
                      Atribuicoes em aberto
                    </span>
                  </div>

                  {activeEmployeeAssignments.length === 0 ? (
                    <div className="text-sm [color:var(--text-secondary)]">
                      Nenhum ativo atribuido no momento.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeEmployeeAssignments.map((assignment, index) => (
                        <article
                          key={`${assignment.id}-${index}`}
                          className="employee-assignments-card rounded-[20px] border border-[var(--border-soft)] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-medium [color:var(--text-primary)]">
                                {assetTitle(assignment.asset)}
                              </div>
                              <div className="mt-1 text-sm [color:var(--text-secondary)]">
                                Codigo: {assignment.asset?.internalCode ?? "-"} | Tipo:{" "}
                                {typeLabel(assignment.asset?.type)} | Marca:{" "}
                                {assignment.asset?.brand ?? "-"} | Modelo:{" "}
                                {assignment.asset?.model ?? "-"}
                              </div>
                            </div>
                            <div className="status-pill">Ativo</div>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm [color:var(--text-secondary)] sm:grid-cols-2">
                            <div>Atribuido em: {formatDate(assignment.assignedAt)}</div>
                            <div>Devolvido em: {formatDate(assignment.returnedAt)}</div>
                          </div>

                          <div className="mt-3 text-sm [color:var(--text-secondary)]">
                            Observacoes: {assignment.notes ?? "-"}
                          </div>

                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => handleReturn(assignment.id)}
                              disabled={actionLoadingId === assignment.id}
                              className="btn-danger px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {actionLoadingId === assignment.id
                                ? "Devolvendo..."
                                : "Devolver"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="employee-assignments-panel employee-assignments-section surface-soft rounded-[24px] p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold [color:var(--text-primary)]">
                      Historico de atribuicoes
                    </h3>
                    <span className="text-xs [color:var(--text-secondary)]">
                      Atribuicoes encerradas
                    </span>
                  </div>

                  {historyAssignments.length === 0 ? (
                    <div className="text-sm [color:var(--text-secondary)]">
                      Nenhum historico encontrado para este funcionario.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historyAssignments.map((assignment, index) => (
                        <article
                          key={`${assignment.id}-${index}`}
                          className="employee-assignments-card rounded-[20px] border border-[var(--border-soft)] p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="font-medium [color:var(--text-primary)]">
                                {assetTitle(assignment.asset)}
                              </div>
                              <div className="mt-1 text-sm [color:var(--text-secondary)]">
                                {assignment.asset?.category?.name ?? "Sem categoria"} |{" "}
                                {assignment.asset?.location?.name ?? "Sem localizacao"}
                              </div>
                            </div>
                            <div className="status-pill">Encerrado</div>
                          </div>

                          <div className="mt-3 grid gap-2 text-sm [color:var(--text-secondary)] sm:grid-cols-2">
                            <div>Atribuido em: {formatDate(assignment.assignedAt)}</div>
                            <div>Devolvido em: {formatDate(assignment.returnedAt)}</div>
                          </div>

                          <div className="mt-3 text-sm [color:var(--text-secondary)]">
                            Observacoes: {assignment.notes ?? "-"}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="action-button">
        <EmployeeIcon />
        Ver ativos
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
