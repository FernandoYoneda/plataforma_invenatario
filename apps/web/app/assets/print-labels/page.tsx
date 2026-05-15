"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, getAsset } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { Asset } from "@/lib/types";
import { createAssetQrDataUrl } from "@/components/AssetQrCodeModal";

const TYPE_LABELS: Record<Asset["type"], string> = {
  DESKTOP: "Desktop",
  NOTEBOOK: "Notebook",
  MONITOR: "Monitor",
  MOUSE: "Mouse",
  TECLADO: "Teclado",
  OUTRO: "Outro",
};

type LabelItem = {
  asset: Asset;
  qrDataUrl: string;
};

function labelSummary(asset: Asset) {
  return [TYPE_LABELS[asset.type], asset.brand, asset.model]
    .filter(Boolean)
    .join(" - ");
}

export default function AssetLabelsPrintPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsQuery = searchParams.get("ids") ?? "";

  const assetIds = useMemo(() => {
    return Array.from(
      new Set(
        idsQuery
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
  }, [idsQuery]);

  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const handleUnauthorized = useCallback(() => {
    clearAuthToken();
    setRedirecting(true);
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    let active = true;

    async function loadLabels() {
      const token = getAuthToken();

      if (!token) {
        handleUnauthorized();
        setLoading(false);
        return;
      }

      if (assetIds.length === 0) {
        setLabels([]);
        setError("Selecione ao menos um asset para imprimir etiquetas.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const assets = await Promise.all(assetIds.map((assetId) => getAsset(assetId, token)));

        if (!active) return;

        const items = await Promise.all(
          assets.map(async (asset) => {
            const assetUrl = new URL(`/assets/${asset.id}`, window.location.origin).toString();
            return {
              asset,
              qrDataUrl: await createAssetQrDataUrl(assetUrl),
            };
          }),
        );

        if (!active) return;

        setLabels(items);
      } catch (err: unknown) {
        if (!active) return;

        if (err instanceof ApiError && err.status === 401) {
          handleUnauthorized();
          return;
        }

        if (err instanceof ApiError && err.status === 404) {
          setError("Um ou mais assets selecionados nao foram encontrados.");
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Nao foi possivel preparar as etiquetas selecionadas.",
          );
        }

        setLabels([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadLabels();

    return () => {
      active = false;
    };
  }, [assetIds, handleUnauthorized]);

  function handlePrint() {
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      setPrinting(false);
    }, 50);
  }

  const selectionCount = assetIds.length;

  return (
    <main className="print-page min-h-screen">
      <div className="print-toolbar no-print mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Impressao em lote</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
            Etiquetas QR
          </h1>
          <p className="mt-1 text-sm [color:var(--text-secondary)]">
            {selectionCount} asset(s) selecionado(s)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/assets" className="btn-secondary px-4 py-2.5 text-sm">
            Voltar para Assets
          </Link>
          <button
            type="button"
            onClick={handlePrint}
            disabled={loading || redirecting || printing || labels.length === 0}
            className="btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
          >
            {printing ? "Abrindo impressao..." : "Imprimir"}
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-8">
        {loading ? (
          <section className="surface-card rounded-[28px] px-6 py-8 text-sm [color:var(--text-secondary)]">
            Preparando etiquetas...
          </section>
        ) : error ? (
          <section className="status-banner-error rounded-[22px] px-4 py-4 text-sm">
            {error}
          </section>
        ) : labels.length === 0 ? (
          <section className="surface-card rounded-[28px] px-6 py-8 text-sm [color:var(--text-secondary)]">
            Nenhuma etiqueta disponivel para impressao.
          </section>
        ) : (
          <section className="print-sheet grid gap-4 md:grid-cols-2">
            {labels.map(({ asset, qrDataUrl }) => (
              <article
                key={asset.id}
                className="print-label surface-card overflow-hidden rounded-[22px] p-4"
              >
                <div className="grid h-full gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
                  <div className="print-qr-frame flex items-center justify-center rounded-[18px] border bg-white p-2 [border-color:var(--border-soft)]">
                    <img
                      src={qrDataUrl}
                      alt={`QR Code do asset ${asset.internalCode}`}
                      className="h-full w-full object-contain"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] [color:var(--text-muted)]">
                      Codigo interno
                    </div>
                    <div className="mt-1 break-words text-lg font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                      {asset.internalCode}
                    </div>

                    <div className="mt-3 text-sm font-medium [color:var(--text-primary)]">
                      {labelSummary(asset) || "-"}
                    </div>

                    <div className="mt-2 space-y-1 text-sm [color:var(--text-secondary)]">
                      {asset.serialNumber ? (
                        <div>
                          <span className="font-semibold [color:var(--text-primary)]">
                            Serial:
                          </span>{" "}
                          {asset.serialNumber}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
