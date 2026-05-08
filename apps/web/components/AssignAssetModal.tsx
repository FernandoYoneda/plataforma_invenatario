"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { createAssignment, getEmployees } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { Asset, Assignment, Employee } from "@/lib/types";

export default function AssignAssetModal({
  asset,
  onAssigned,
}: {
  asset: Asset;
  onAssigned: (assignment: Assignment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employeesError, setEmployeesError] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [notes, setNotes] = useState("");

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
        setEmployeesError("Sessao expirada. Faca login novamente.");
        setEmployees([]);
        return;
      }

      setLoadingEmployees(true);
      setEmployeesError(null);

      try {
        const data = await getEmployees(token);
        if (!active) return;
        setEmployees(data);
      } catch (err: unknown) {
        if (!active) return;

        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar os funcionarios.";

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
      const message = "Selecione um funcionario.";
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

      toast.success("Asset atribuido com sucesso.");
      resetForm();
      setOpen(false);
      onAssigned(assignment);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nao foi possivel atribuir o asset.";
      setError(message);
      toast.error(message);
    } finally {
      setLoadingSubmit(false);
    }
  }

  const modal = (
    <div className="fixed inset-0 z-[99999]" onClick={close}>
      <div className="absolute inset-0 bg-[#1f2937]/65 backdrop-blur-[2px]" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-xl overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.22)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8c5f46]">
                Atribuicao
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#1f2937]">
                Atribuir {asset.internalCode}
              </h2>
            </div>

            <button
              type="button"
              onClick={close}
              disabled={loadingSubmit}
              className="rounded-2xl border border-[#d7d4cd] px-3 py-2 text-sm text-[#6b7280] transition hover:bg-[#f9f5ef] disabled:opacity-50"
            >
              Fechar
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-2xl border border-black/10 bg-[#fcfaf7] px-4 py-3 text-sm text-[#374151]">
                <div className="font-medium text-[#111827]">
                  {asset.brand} {asset.model ?? ""}
                </div>
                <div className="mt-1 text-[#6b7280]">
                  {asset.type} • {asset.serialNumber ?? "Sem serial"}
                </div>
              </div>

              <label className="block text-sm">
                <span className="font-medium text-[#374151]">Funcionario</span>
                <select
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  disabled={loadingEmployees || employees.length === 0}
                  className="mt-1.5 w-full rounded-2xl border border-[#d7d4cd] bg-[#fcfaf7] px-4 py-3 text-[#111827] outline-none transition focus:border-[#8c5f46] focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <option value="">
                    {loadingEmployees
                      ? "Carregando funcionarios..."
                      : employees.length === 0
                        ? "Nenhum funcionario cadastrado"
                        : "Selecione um funcionario"}
                  </option>
                  {employees.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {item.email}
                    </option>
                  ))}
                </select>
              </label>

              {selectedEmployee && (
                <div className="rounded-2xl border border-black/10 bg-[#f9f5ef] px-4 py-3 text-sm text-[#374151]">
                  <div className="font-medium text-[#111827]">
                    {selectedEmployee.name}
                  </div>
                  <div className="mt-1">
                    {selectedEmployee.department ?? "Sem departamento"} •{" "}
                    {selectedEmployee.position ?? "Sem cargo"}
                  </div>
                </div>
              )}

              <label className="block text-sm">
                <span className="font-medium text-[#374151]">Observacoes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="mt-1.5 w-full rounded-2xl border border-[#d7d4cd] bg-[#fcfaf7] px-4 py-3 text-[#111827] outline-none transition focus:border-[#8c5f46] focus:bg-white"
                  placeholder="Observacoes opcionais da atribuicao."
                />
              </label>

              {employeesError && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {employeesError}
                </div>
              )}

              {!loadingEmployees && employees.length === 0 && !employeesError && (
                <div className="rounded-2xl border border-[#d7d4cd] bg-[#fcfaf7] px-4 py-3 text-sm text-[#6b7280]">
                  Nenhum funcionario cadastrado. O formulario continua disponivel,
                  mas e necessario cadastrar um funcionario no backend para criar
                  atribuicoes.
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-black/10 px-6 py-5">
              <button
                type="button"
                onClick={close}
                disabled={loadingSubmit}
                className="rounded-2xl border border-[#d7d4cd] bg-white px-4 py-3 text-sm font-medium text-[#374151] transition hover:bg-[#f9f5ef] disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loadingSubmit || loadingEmployees || employees.length === 0}
                className="rounded-2xl bg-[#8c5f46] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
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
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="rounded-xl border border-[#d7d4cd] bg-white px-3 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#f9f5ef]"
      >
        Atribuir
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
