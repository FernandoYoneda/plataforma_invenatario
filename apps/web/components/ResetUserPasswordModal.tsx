"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { SystemUser } from "@/lib/types";

export default function ResetUserPasswordModal({
  open,
  user,
  onClose,
  onSubmit,
}: {
  open: boolean;
  user: SystemUser | null;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    setPassword("");
    setConfirmation("");
    setError(null);
  }, [open]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.trim().length < 8) {
      const message = "A nova senha precisa ter pelo menos 8 caracteres.";
      setError(message);
      toast.error(message);
      return;
    }

    if (password !== confirmation) {
      const message = "As senhas não conferem.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);

    try {
      await onSubmit(password);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Não foi possível redefinir a senha.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted || !open || !user) {
    return null;
  }

  const modal = (
    <div className="fixed inset-0 z-[99999]" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(23,58,67,0.66)] backdrop-blur-[3px]" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="glass-panel w-full max-w-lg overflow-hidden rounded-[30px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
            <p className="eyebrow">Usuários</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
              Redefinir senha
            </h2>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4 px-6 py-5">
              <div className="surface-soft rounded-[24px] px-4 py-4 text-sm [color:var(--text-secondary)]">
                <strong className="[color:var(--text-primary)]">{user.name}</strong>
                <div className="mt-1">{user.email}</div>
              </div>

              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Nova senha *
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="brand-input mt-1.5"
                  placeholder="Mínimo de 8 caracteres"
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Confirmar senha *
                </span>
                <input
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="brand-input mt-1.5"
                  placeholder="Repita a nova senha"
                />
              </label>

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
                disabled={loading}
                className="btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Salvando..." : "Redefinir senha"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
