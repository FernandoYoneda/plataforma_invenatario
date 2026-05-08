"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { createEmployee } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { Employee } from "@/lib/types";

export default function NewEmployeeModal({
  onCreated,
}: {
  onCreated: (employee: Employee) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [open]);

  function close() {
    if (!loading) {
      setOpen(false);
    }
  }

  function resetForm() {
    setName("");
    setEmail("");
    setDepartment("");
    setPosition("");
    setError(null);
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

    const token = getAuthToken();

    if (!token) {
      const message = "Sessao expirada. Faca login novamente.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);

    try {
      const employee = await createEmployee(
        {
          name: name.trim(),
          email: email.trim(),
          department: department.trim() || null,
          position: position.trim() || null,
        },
        token,
      );

      toast.success("Funcionario criado com sucesso.");
      resetForm();
      setOpen(false);
      onCreated(employee);
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error ? err.message : "Nao foi possivel criar o funcionario.";

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
              <p className="eyebrow">Cadastro</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                Novo Funcionario
              </h2>
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
            <div className="space-y-4 px-6 py-5">
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
                {loading ? "Criando..." : "Criar funcionario"}
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
        className="btn-primary px-4 py-2.5 text-sm"
      >
        Novo Funcionario
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
