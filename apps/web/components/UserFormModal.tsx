"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { roleLabel } from "@/lib/permissions";
import type { SystemUser } from "@/lib/types";

type UserFormMode = "create" | "edit";

type UserFormValues = {
  name: string;
  email: string;
  password: string;
  role: SystemUser["role"];
};

const ROLE_OPTIONS: SystemUser["role"][] = ["ADMIN", "TI", "GESTOR", "LEITURA"];

export default function UserFormModal({
  open,
  mode,
  user,
  title,
  submitLabel,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: UserFormMode;
  user?: SystemUser | null;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SystemUser["role"]>(user?.role ?? "LEITURA");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setPassword("");
    setRole(user?.role ?? "LEITURA");
    setError(null);
  }, [open, user]);

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

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose, open]);

  const isCreate = mode === "create";

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!name.trim()) return false;
    if (isCreate && (!email.trim() || !password.trim())) return false;
    return true;
  }, [email, isCreate, loading, name, password]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      const message = "Nome é obrigatório.";
      setError(message);
      toast.error(message);
      return;
    }

    if (isCreate && !email.trim()) {
      const message = "Email é obrigatório.";
      setError(message);
      toast.error(message);
      return;
    }

    if (isCreate && password.trim().length < 8) {
      const message = "Senha inicial precisa ter pelo menos 8 caracteres.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);

    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Não foi possível salvar o usuário.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted || !open) {
    return null;
  }

  const modal = (
    <div className="fixed inset-0 z-[99999]" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(23,58,67,0.66)] backdrop-blur-[3px]" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="glass-panel w-full max-w-2xl overflow-hidden rounded-[30px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-6 py-5 [border-color:var(--border-soft)]">
            <div>
              <p className="eyebrow">Usuários</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                {title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary px-3 py-2 text-sm disabled:opacity-50"
            >
              Fechar
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
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
                    Perfil *
                  </span>
                  <select
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value as SystemUser["role"])
                    }
                    className="brand-input mt-1.5"
                  >
                    {ROLE_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {roleLabel(item)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {isCreate ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="font-medium [color:var(--text-primary)]">
                      Email *
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="brand-input mt-1.5"
                      placeholder="usuario@empresa.com"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium [color:var(--text-primary)]">
                      Senha inicial *
                    </span>
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="brand-input mt-1.5"
                      placeholder="Mínimo de 8 caracteres"
                    />
                  </label>
                </div>
              ) : null}

              {!isCreate ? (
                <div className="surface-soft rounded-[24px] px-4 py-4 text-sm [color:var(--text-secondary)]">
                  Email e senha inicial não podem ser alterados nesta tela.
                </div>
              ) : null}

              {error ? (
                <div className="status-banner-error rounded-[22px] px-4 py-3 text-sm">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-5 [border-color:var(--border-soft)]">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn-secondary px-4 py-3 text-sm disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Salvando..." : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
