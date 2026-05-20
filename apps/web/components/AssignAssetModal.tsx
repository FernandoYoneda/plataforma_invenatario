"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { createAssignment, getActiveEmployees } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { canManageAssignments } from "@/lib/permissions";
import type { Asset, Assignment, Employee } from "@/lib/types";
import { useAuth } from "./AuthProvider";

function AssignIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 12h8" />
      <path d="M12 8v8" />
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
    </svg>
  );
}

export default function AssignAssetModal({
  asset,
  onAssigned,
  open: openProp,
  onOpenChange,
  triggerClassName,
  hideTrigger,
  onTrigger,
}: {
  asset: Asset;
  onAssigned: (assignment: Assignment) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
  hideTrigger?: boolean;
  onTrigger?: () => void;
}) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

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

    async function loadEmployees() {
      const token = getAuthToken();

      if (!token) {
        if (!active) return;
        setEmployeesError("Sessão expirada. Faça login novamente.");
        setEmployees([]);
        return;
      }

      setLoadingEmployees(true);
      setEmployeesError(null);

      try {
        const data = await getActiveEmployees(token);
        if (!active) return;
        const withLocation = data.filter(
          (item) => Boolean(item.locationId ?? item.location?.id),
        );
        setEmployees(withLocation);
        if (withLocation.length !== data.length) {
          setEmployeesError(
            "Alguns funcionarios ativos foram ocultados por nao terem localizacao cadastrada.",
          );
        }
      } catch (err: unknown) {
        if (!active) return;

        const message =
          err instanceof Error
            ? err.message
            : "Não foi possível carregar os funcionários.";

        setEmployees([]);
        setEmployeesError(message);
      } finally {
        if (active) {
          setLoadingEmployees(false);
        }
      }
    }

    loadEmployees();

    return () => {
      active = false;
    };
  }, [open]);

  const selectedEmployee = useMemo(
    () => employees.find((item) => item.id === employeeId) ?? null,
    [employeeId, employees],
  );

  function close() {
    if (!loadingSubmit) {
      setOpen(false);
    }
  }

  function resetForm() {
    setEmployeeId("");
    setNotes("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!employeeId) {
      const message = "Selecione um funcionário.";
      setError(message);
      toast.error(message);
      return;
    }

    if (!selectedEmployee?.locationId && !selectedEmployee?.location?.id) {
      const message =
        "Funcionario precisa de localizacao para receber ativos.";
      setError(message);
      toast.error(message);
      return;
    }

    const token = getAuthToken();

    if (!token) {
      const message = "Sessão expirada. Faça login novamente.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoadingSubmit(true);

    try {
      const assignment = await createAssignment(
        {
          assetId: asset.id,
          employeeId,
          notes: notes.trim() || null,
        },
        token,
      );

      toast.success("Ativo atribuído com sucesso.");
      resetForm();
      setOpen(false);
      onAssigned(assignment);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Não foi possível atribuir o ativo.";
      setError(message);
      toast.error(message);
    } finally {
      setLoadingSubmit(false);
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
          className="glass-panel w-full max-w-xl overflow-hidden rounded-[30px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-6 py-5 [border-color:var(--border-soft)]">
            <div>
              <p className="eyebrow">Atribuição</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                Atribuir {asset.internalCode}
              </h2>
            </div>

            <button
              type="button"
              onClick={close}
              disabled={loadingSubmit}
              className="btn-secondary px-3 py-2 text-sm disabled:opacity-50"
            >
              Fechar
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 px-6 py-5">
              <div className="surface-soft rounded-[24px] px-4 py-3 text-sm [color:var(--text-secondary)]">
                <div className="font-medium [color:var(--text-primary)]">
                  {asset.brand} {asset.model ?? ""}
                </div>
                <div className="mt-1">
                  {asset.type} | {asset.serialNumber ?? "Sem serial"}
                </div>
              </div>

              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Funcionário
                </span>
                <select
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  disabled={loadingEmployees || employees.length === 0}
                  className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="">
                    {loadingEmployees
                      ? "Carregando funcionários..."
                      : employees.length === 0
                        ? "Nenhum funcionário cadastrado"
                        : "Selecione um funcionário"}
                  </option>
                  {employees.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {item.email}
                    </option>
                  ))}
                </select>
              </label>

              {selectedEmployee && (
                <div className="surface-soft rounded-[24px] px-4 py-3 text-sm [color:var(--text-secondary)]">
                  <div className="font-medium [color:var(--text-primary)]">
                    {selectedEmployee.name}
                  </div>
                  <div className="mt-1">
                    {selectedEmployee.department ?? "Sem departamento"} |{" "}
                    {selectedEmployee.position ?? "Sem cargo"}
                  </div>
                </div>
              )}

              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Observações
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="brand-input mt-1.5"
                  placeholder="Observações opcionais da atribuição."
                />
              </label>

              {employeesError && (
                <div className="status-banner-warning rounded-[22px] px-4 py-3 text-sm">
                  {employeesError}
                </div>
              )}

              {!loadingEmployees && employees.length === 0 && !employeesError && (
                <div className="surface-soft rounded-[22px] px-4 py-3 text-sm [color:var(--text-secondary)]">
                  Nenhum funcionário cadastrado. O formulário continua disponível,
                  mas é necessário cadastrar um funcionário no backend para criar
                  atribuições.
                </div>
              )}

              {error && (
                <div className="status-banner-error rounded-[22px] px-4 py-3 text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-5 [border-color:var(--border-soft)]">
              <button
                type="button"
                onClick={close}
                disabled={loadingSubmit}
                className="btn-secondary px-4 py-3 text-sm disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loadingSubmit || loadingEmployees || employees.length === 0}
                className="btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingSubmit ? "Atribuindo..." : "Atribuir"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {hideTrigger ? null : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            onTrigger?.();
            setOpen(true);
          }}
          className={`action-button ${triggerClassName ?? ""}`.trim()}
        >
          <AssignIcon />
          Atribuir
        </button>
      )}

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
