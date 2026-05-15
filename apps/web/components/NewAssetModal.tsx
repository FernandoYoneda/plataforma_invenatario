"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { createAsset, getCategories, getLocations } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type {
  Asset,
  AssetStatus,
  AssetType,
  Category,
  Location,
} from "@/lib/types";

const TYPES: { value: AssetType; label: string }[] = [
  { value: "DESKTOP", label: "Computador (Desktop)" },
  { value: "NOTEBOOK", label: "Notebook" },
  { value: "MONITOR", label: "Monitor" },
  { value: "MOUSE", label: "Mouse" },
  { value: "TECLADO", label: "Teclado" },
  { value: "OUTRO", label: "Outro" },
];

const STATUS: { value: AssetStatus; label: string }[] = [
  { value: "EM_USO", label: "Em uso" },
  { value: "ESTOQUE", label: "Estoque" },
  { value: "MANUTENCAO", label: "Manutencao" },
  { value: "BAIXADO", label: "Baixado" },
];

function parseBRLToCents(input: string): number | null {
  const s = input.trim();
  if (!s) return null;

  const normalized = s.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);

  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export default function NewAssetModal({
  onCreated,
}: {
  onCreated: (asset: Asset) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<AssetType>("NOTEBOOK");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [status, setStatus] = useState<AssetStatus>("ESTOQUE");
  const [valueBRL, setValueBRL] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [referencesError, setReferencesError] = useState<string | null>(null);

  const brandInputRef = useRef<HTMLInputElement | null>(null);

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

    const id = window.setTimeout(() => brandInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let active = true;

    async function loadReferences() {
      const token = getAuthToken();

      if (!token) {
        if (!active) return;
        setReferencesError("Sessao expirada. Faca login novamente.");
        setCategories([]);
        setLocations([]);
        return;
      }

      setLoadingReferences(true);
      setReferencesError(null);

      try {
        const [categoriesData, locationsData] = await Promise.all([
          getCategories(token),
          getLocations(token),
        ]);

        if (!active) return;
        setCategories(categoriesData);
        setLocations(locationsData);
      } catch (err: unknown) {
        if (!active) return;

        const message =
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar categorias e locais.";

        setReferencesError(message);
        setCategories([]);
        setLocations([]);
      } finally {
        if (active) {
          setLoadingReferences(false);
        }
      }
    }

    loadReferences();

    return () => {
      active = false;
    };
  }, [open]);

  const valueCents = useMemo(() => parseBRLToCents(valueBRL), [valueBRL]);
  const needsValue =
    type === "DESKTOP" || type === "NOTEBOOK" || type === "MONITOR";

  function close() {
    if (!loading) {
      setOpen(false);
    }
  }

  function resetForm() {
    setType("NOTEBOOK");
    setBrand("");
    setModel("");
    setSerialNumber("");
    setStatus("ESTOQUE");
    setValueBRL("");
    setNotes("");
    setCategoryId("");
    setLocationId("");
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!brand.trim()) {
      const message = "Marca e obrigatoria.";
      setError(message);
      toast.error(message);
      return;
    }

    if (needsValue && valueCents == null) {
      const message = "Valor e obrigatorio para Desktop, Notebook e Monitor.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);

    try {
      const token = getAuthToken();

      if (!token) {
        throw new Error("Sessao expirada. Faca login novamente.");
      }

      const asset = await createAsset(
        {
          type,
          brand: brand.trim(),
          model: model.trim() || null,
          serialNumber: serialNumber.trim() || null,
          status,
          valueCents: needsValue
            ? (valueCents as number)
            : (valueCents ?? null),
          notes: notes.trim() || null,
          ...(categoryId ? { categoryId } : {}),
          ...(locationId ? { locationId } : {}),
        },
        token,
      );

      toast.success("Asset criado com sucesso.");
      resetForm();
      setOpen(false);
      onCreated(asset);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar asset.";
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
          className="glass-panel w-full max-w-2xl overflow-hidden rounded-[30px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-6 py-5 [border-color:var(--border-soft)]">
            <div>
              <p className="eyebrow">Cadastro</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                Novo Asset
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

          <form onSubmit={submit}>
            <div className="max-h-[75vh] overflow-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="font-medium [color:var(--text-primary)]">
                    Tipo
                  </span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as AssetType)}
                    className="brand-input mt-1.5"
                  >
                    {TYPES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="font-medium [color:var(--text-primary)]">
                    Status
                  </span>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as AssetStatus)
                    }
                    className="brand-input mt-1.5"
                  >
                    {STATUS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="font-medium [color:var(--text-primary)]">
                    Categoria
                  </span>
                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    disabled={loadingReferences}
                    className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="">
                      {loadingReferences
                        ? "Carregando categorias..."
                        : "Sem categoria"}
                    </option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="font-medium [color:var(--text-primary)]">
                    Localização
                  </span>
                  <select
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                    disabled={loadingReferences}
                    className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="">
                      {loadingReferences
                        ? "Carregando locais..."
                        : "Sem localização"}
                    </option>
                    {locations.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="font-medium [color:var(--text-primary)]">
                    Marca *
                  </span>
                  <input
                    ref={brandInputRef}
                    value={brand}
                    onChange={(event) => setBrand(event.target.value)}
                    className="brand-input mt-1.5"
                    placeholder="Dell, LG, Logitech..."
                  />
                </label>

                <label className="text-sm">
                  <span className="font-medium [color:var(--text-primary)]">
                    Modelo
                  </span>
                  <input
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    className="brand-input mt-1.5"
                    placeholder="Latitude 5420, UltraSharp..."
                  />
                </label>

                <label className="text-sm">
                  <span className="font-medium [color:var(--text-primary)]">
                    Serial
                  </span>
                  <input
                    value={serialNumber}
                    onChange={(event) => setSerialNumber(event.target.value)}
                    className="brand-input mt-1.5"
                    placeholder="ABC123456"
                  />
                </label>

                <label className="text-sm">
                  <span className="font-medium [color:var(--text-primary)]">
                    Valor {needsValue ? "*" : "(opcional)"} (R$)
                  </span>
                  <input
                    value={valueBRL}
                    onChange={(event) => setValueBRL(event.target.value)}
                    className="brand-input mt-1.5"
                    placeholder="3500,00"
                  />
                </label>

                <label className="text-sm sm:col-span-2">
                  <span className="font-medium [color:var(--text-primary)]">
                    Observacoes
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="brand-input mt-1.5"
                    rows={4}
                    placeholder="Observacoes opcionais sobre o asset."
                  />
                </label>
              </div>

              {error && (
                <div className="status-banner-error mt-4 rounded-[22px] px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              {referencesError && (
                <div className="status-banner-warning mt-4 rounded-[22px] px-4 py-3 text-sm">
                  {referencesError}
                </div>
              )}

              <div className="status-banner-warning mt-4 rounded-[22px] px-4 py-3 text-sm">
                {needsValue
                  ? "Para Desktop, Notebook e Monitor, o valor e obrigatorio."
                  : "Para este tipo, o valor pode ficar vazio."}
              </div>
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
                {loading ? "Criando..." : "Criar asset"}
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
        Novo Asset
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
