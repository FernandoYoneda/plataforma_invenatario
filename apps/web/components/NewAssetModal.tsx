"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { AssetStatus, AssetType } from "@/lib/types";

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
  { value: "MANUTENCAO", label: "Manutenção" },
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
  onCreated: () => void;
}) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

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

  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ trava/destrava scroll quando abre/fecha
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // ✅ ESC fecha o modal
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading]);

  const valueCents = useMemo(() => parseBRLToCents(valueBRL), [valueBRL]);
  const needsValue =
    type === "DESKTOP" || type === "NOTEBOOK" || type === "MONITOR";

  function close() {
    if (!loading) setOpen(false);
  }

  function resetForm() {
    setType("NOTEBOOK");
    setBrand("");
    setModel("");
    setSerialNumber("");
    setStatus("ESTOQUE");
    setValueBRL("");
    setNotes("");
    setError(null);
  }

  async function submit() {
    setError(null);

    if (!brand.trim()) {
      const message = "Marca é obrigatória.";
      setError(message);
      toast.error(message);
      return;
    }

    if (needsValue && valueCents == null) {
      const message = "Valor é obrigatório para Desktop/Notebook/Monitor.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          brand: brand.trim(),
          model: model.trim() || null,
          serialNumber: serialNumber.trim() || null,
          status,
          valueCents: needsValue
            ? (valueCents as number)
            : (valueCents ?? null),
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Falha ao criar ativo.");
      }

      toast.success("Ativo cadastrado com sucesso");
      resetForm();
      setOpen(false);
      onCreated();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro ao criar ativo.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-[var(--border)] bg-white/10 px-3 py-2 text-sm hover:bg-white/15"
      >
        + Novo ativo
      </button>

      {open &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[99999]">
            {/* overlay */}
            <div className="absolute inset-0 bg-black/70" onClick={close} />

            {/* container */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div
                className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* header */}
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                  <h2 className="text-base font-semibold">
                    Cadastrar novo ativo
                  </h2>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:bg-white/5"
                  >
                    Fechar
                  </button>
                </div>

                {/* body */}
                <div className="max-h-[75vh] overflow-auto p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="text-[var(--muted)]">Tipo</span>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as AssetType)}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                      >
                        {TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm">
                      <span className="text-[var(--muted)]">Status</span>
                      <select
                        value={status}
                        onChange={(e) =>
                          setStatus(e.target.value as AssetStatus)
                        }
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                      >
                        {STATUS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm">
                      <span className="text-[var(--muted)]">Marca *</span>
                      <input
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                        placeholder="Ex.: Dell, LG, Logitech..."
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-[var(--muted)]">Modelo</span>
                      <input
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                        placeholder="Ex.: Latitude 5420..."
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-[var(--muted)]">Serial</span>
                      <input
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                        placeholder="Ex.: ABC123..."
                      />
                    </label>

                    <label className="text-sm">
                      <span className="text-[var(--muted)]">
                        Valor {needsValue ? "*" : "(opcional)"} (R$)
                      </span>
                      <input
                        value={valueBRL}
                        onChange={(e) => setValueBRL(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                        placeholder="Ex.: 3500,00"
                      />
                    </label>

                    <label className="text-sm sm:col-span-2">
                      <span className="text-[var(--muted)]">Observações</span>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
                        rows={3}
                        placeholder="Ex.: comprado em 2024, está com usuário X..."
                      />
                    </label>
                  </div>

                  {error && (
                    <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                      {error}
                    </div>
                  )}
                </div>

                {/* footer */}
                <div className="flex justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
                  <button
                    type="button"
                    onClick={close}
                    disabled={loading}
                    className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm hover:brightness-110 disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={submit}
                    disabled={loading}
                    className="rounded-xl border border-[var(--border)] bg-white/15 px-3 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
                  >
                    {loading ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
