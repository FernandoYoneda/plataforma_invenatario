"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { getLocations, updateEmployee } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { canManageEmployees } from "@/lib/permissions";
import type { Employee, Location } from "@/lib/types";
import { useAuth } from "./AuthProvider";

export default function EditEmployeeModal({
  employee,
  onUpdated,
}: {
  employee: Employee;
  onUpdated: (employee: Employee) => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referencesError, setReferencesError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);

  const [name, setName] = useState(employee.name);
  const [email, setEmail] = useState(employee.email);
  const [department, setDepartment] = useState(employee.department ?? "");
  const [position, setPosition] = useState(employee.position ?? "");
  const [locationId, setLocationId] = useState(employee.locationId ?? employee.location?.id ?? "");

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

    setName(employee.name);
    setEmail(employee.email);
    setDepartment(employee.department ?? "");
    setPosition(employee.position ?? "");
    setLocationId(employee.locationId ?? employee.location?.id ?? "");
    setError(null);
    setReferencesError(null);
  }, [employee, open]);

  useEffect(() => {
    if (!open) return;

    let active = true;

    async function loadLocations() {
      const token = getAuthToken();

      if (!token) {
        if (!active) return;
        setReferencesError("Sessao expirada. Faca login novamente.");
        setLocations([]);
        return;
      }

      setLoadingLocations(true);
      setReferencesError(null);

      try {
        const locationsData = await getLocations(token);
        if (!active) return;
        setLocations(locationsData);
      } catch (err: unknown) {
        if (!active) return;
        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar as localizacoes.";
        setReferencesError(message);
        setLocations([]);
      } finally {
        if (active) {
          setLoadingLocations(false);
        }
      }
    }

    loadLocations();

    return () => {
      active = false;
    };
  }, [open]);

  function close() {
    if (!loading) {
      setOpen(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      const message = "Nome e obrigatorio.";
      setError(message);
      toast.error(message);
      return;
    }

    if (!email.trim()) {
      const message = "Email e obrigatorio.";
      setError(message);
      toast.error(message);
      return;
    }

    if (!locationId) {
      const message = "Localizacao e obrigatoria.";
      setError(message);
      toast.error(message);
      return;
    }

    const token = getAuthToken();

    if (!token) {
      const message = "Sessao expirada. Faca login novamente.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);

    try {
      const updated = await updateEmployee(
        employee.id,
        {
          name: name.trim(),
          email: email.trim(),
          department: department.trim() || null,
          position: position.trim() || null,
          locationId,
        },
        token,
      );

      toast.success("Funcionario atualizado com sucesso.");
      setOpen(false);
      onUpdated(updated);
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error ? err.message : "Nao foi possivel atualizar o funcionario.";
      const message =
        rawMessage.toLowerCase().includes("email") ||
        rawMessage.toLowerCase().includes("ja existe")
          ? "Ja existe um funcionario cadastrado com esse email."
          : rawMessage;

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!canManageEmployees(user?.role)) {
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
              <p className="eyebrow">Edicao</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                Editar Funcionário
              </h2>
              <p className="mt-1 text-sm [color:var(--text-secondary)]">
                {employee.email}
              </p>
            </div>

            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="btn-secondary px-3 py-2 text-sm disabled:opacity-50"
            >
              Fechar
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="max-h-[75vh] space-y-4 overflow-auto px-6 py-5">
              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Nome *
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="brand-input mt-1.5"
                  placeholder="Nome completo"
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Email *
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="brand-input mt-1.5"
                  placeholder="funcionario@empresa.com"
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Departamento
                </span>
                <input
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  className="brand-input mt-1.5"
                  placeholder="Financeiro, RH, TI..."
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Cargo
                </span>
                <input
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  className="brand-input mt-1.5"
                  placeholder="Analista, Coordenador..."
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Localização *
                </span>
                <select
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  disabled={loadingLocations}
                  className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="">
                    {loadingLocations
                      ? "Carregando localizações..."
                      : "Selecione uma localização"}
                  </option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="status-banner-warning rounded-[22px] px-4 py-3 text-sm">
                Ativos atribuídos a este funcionário herdarão essa localização.
              </div>

              {error && (
                <div className="status-banner-error rounded-[22px] px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              {referencesError && (
                <div className="status-banner-warning rounded-[22px] px-4 py-3 text-sm">
                  {referencesError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-5 [border-color:var(--border-soft)]">
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="btn-secondary px-4 py-3 text-sm disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="action-button"
      >
        Editar funcionário
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
