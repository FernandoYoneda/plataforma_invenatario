"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getCategories, getLocations, updateAsset } from "@/lib/api";
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

function currentCategoryId(asset: Asset) {
  return asset.categoryId ?? asset.category?.id ?? "";
}

function currentLocationId(asset: Asset) {
  return asset.locationId ?? asset.location?.id ?? "";
}

function friendlyUpdateError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Nao foi possivel atualizar o asset.";

  if (message.toLowerCase().includes("valuecents")) {
    return "Este tipo exige valor cadastrado. Ajuste o asset antes de usar esse tipo.";
  }

  return message;
}

export default function EditAssetModal({
  asset,
  categories: providedCategories,
  locations: providedLocations,
  onUpdated,
}: {
  asset: Asset;
  categories?: Category[];
  locations?: Location[];
  onUpdated?: (asset: Asset) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<AssetType>(asset.type);
  const [brand, setBrand] = useState(asset.brand);
  const [model, setModel] = useState(asset.model ?? "");
  const [serialNumber, setSerialNumber] = useState(asset.serialNumber ?? "");
  const [status, setStatus] = useState<AssetStatus>(asset.status);
  const [categoryId, setCategoryId] = useState(currentCategoryId(asset));
  const [locationId, setLocationId] = useState(currentLocationId(asset));
  const [notes, setNotes] = useState(asset.notes ?? "");
  const [categories, setCategories] = useState<Category[]>(
    providedCategories ?? [],
  );
  const [locations, setLocations] = useState<Location[]>(
    providedLocations ?? [],
  );
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [referencesError, setReferencesError] = useState<string | null>(null);

  const brandInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (providedCategories) {
      setCategories(providedCategories);
    }
  }, [providedCategories]);

  useEffect(() => {
    if (providedLocations) {
      setLocations(providedLocations);
    }
  }, [providedLocations]);

  useEffect(() => {
    if (!open) return;

    setType(asset.type);
    setBrand(asset.brand);
    setModel(asset.model ?? "");
    setSerialNumber(asset.serialNumber ?? "");
    setStatus(asset.status);
    setCategoryId(currentCategoryId(asset));
    setLocationId(currentLocationId(asset));
    setNotes(asset.notes ?? "");
    setError(null);
  }, [asset, open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || (providedCategories && providedLocations)) return;

    let active = true;

    async function loadReferences() {
      const token = getAuthToken();

      if (!token) {
        if (!active) return;
        setReferencesError("Sessao expirada. Faca login novamente.");
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
            : "Nao foi possivel carregar categorias e localizacoes.";
        setReferencesError(message);
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
  }, [open, providedCategories, providedLocations]);

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

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const selectedLocation = useMemo(
    () => locations.find((item) => item.id === locationId) ?? null,
    [locations, locationId],
  );

  function close() {
    if (!loading) {
      setOpen(false);
    }
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

    const token = getAuthToken();

    if (!token) {
      const message = "Sessao expirada. Faca login novamente.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);

    try {
      const updated = await updateAsset(
        asset.id,
        {
          type,
          brand: brand.trim(),
          model: model.trim() || null,
          serialNumber: serialNumber.trim() || null,
          status,
          categoryId: categoryId || null,
          locationId: locationId || null,
          notes: notes.trim() || null,
        },
        token,
      );

      const mergedAsset: Asset = {
        ...asset,
        ...updated,
        categoryId: categoryId || null,
        locationId: locationId || null,
        category: selectedCategory,
        location: selectedLocation,
      };

      toast.success("Asset atualizado com sucesso.");
      setOpen(false);
      onUpdated?.(mergedAsset);
      if (!onUpdated) {
        router.refresh();
      }
    } catch (err: unknown) {
      const message = friendlyUpdateError(err);
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
              <p className="eyebrow">Edicao</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                Editar Asset
              </h2>
              <p className="mt-1 text-sm [color:var(--text-secondary)]">
                {asset.internalCode}
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
                    Localizacao
                  </span>
                  <select
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                    disabled={loadingReferences}
                    className="brand-input mt-1.5 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="">
                      {loadingReferences
                        ? "Carregando localizacoes..."
                        : "Sem localizacao"}
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
                {loading ? "Salvando..." : "Salvar alteracoes"}
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
        className="action-button"
      >
        Editar
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
