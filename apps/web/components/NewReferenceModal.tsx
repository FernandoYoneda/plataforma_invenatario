"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { getAuthToken } from "@/lib/auth";
import { canManageReferences } from "@/lib/permissions";
import { useAuth } from "./AuthProvider";

type ReferenceItem = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};

type CreateReferenceInput = {
  name: string;
  description?: string | null;
};

export default function NewReferenceModal<TItem extends ReferenceItem>({
  buttonLabel,
  title,
  createLabel,
  successMessage,
  namePlaceholder,
  descriptionPlaceholder,
  createItem,
  onCreated,
}: {
  buttonLabel: string;
  title: string;
  createLabel: string;
  successMessage: string;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  createItem: (
    payload: CreateReferenceInput,
    token?: string | null,
  ) => Promise<TItem>;
  onCreated: (item: TItem) => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const nameInputRef = useRef<HTMLInputElement | null>(null);

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

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading]);

  useEffect(() => {
    if (!open) return;

    const id = window.setTimeout(() => nameInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  function close() {
    if (!loading) {
      setOpen(false);
    }
  }

  function resetForm() {
    setName("");
    setDescription("");
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

    const token = getAuthToken();

    if (!token) {
      const message = "Sessao expirada. Faca login novamente.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);

    try {
      const item = await createItem(
        {
          name: name.trim(),
          description: description.trim() || null,
        },
        token,
      );

      toast.success(successMessage);
      resetForm();
      setOpen(false);
      onCreated(item);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nao foi possivel concluir o cadastro.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  if (!canManageReferences(user?.role)) {
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
              <p className="eyebrow">Cadastro</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                {title}
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
                  ref={nameInputRef}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="brand-input mt-1.5"
                  placeholder={namePlaceholder}
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Descricao
                </span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="brand-input mt-1.5"
                  placeholder={descriptionPlaceholder}
                  rows={4}
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
                {loading ? "Criando..." : createLabel}
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
        {buttonLabel}
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
