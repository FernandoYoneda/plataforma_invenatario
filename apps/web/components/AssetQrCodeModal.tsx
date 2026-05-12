"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import type { Asset } from "@/lib/types";

function QrIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 4h6v6H4V4Z" />
      <path d="M14 4h6v6h-6V4Z" />
      <path d="M4 14h6v6H4v-6Z" />
      <path d="M14 14h2v2h-2v-2Z" />
      <path d="M18 14h2v6h-2v-6Z" />
      <path d="M14 18h2v2h-2v-2Z" />
    </svg>
  );
}

function assetTitle(asset: Asset) {
  return [asset.brand, asset.model].filter(Boolean).join(" ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function AssetQrCodeModal({ asset }: { asset: Asset }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [assetUrl, setAssetUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => assetTitle(asset), [asset]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    setAssetUrl(new URL(`/assets/${asset.id}`, window.location.origin).toString());
  }, [asset.id, mounted]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [open]);

  useEffect(() => {
    if (!open || !assetUrl) return;

    let active = true;
    setQrDataUrl(null);
    setError(null);

    QRCode.toDataURL(assetUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 280,
      color: {
        dark: "#173a43",
        light: "#ffffff",
      },
    })
      .then((value) => {
        if (active) {
          setQrDataUrl(value);
        }
      })
      .catch(() => {
        if (active) {
          setError("Nao foi possivel gerar o QR Code deste asset.");
        }
      });

    return () => {
      active = false;
    };
  }, [assetUrl, open]);

  function handlePrint() {
    if (!qrDataUrl) return;

    const printWindow = window.open("", "_blank", "width=480,height=640");

    if (!printWindow) {
      window.print();
      return;
    }

    const safeCode = escapeHtml(asset.internalCode);
    const safeTitle = escapeHtml(title || "-");
    const safeUrl = escapeHtml(assetUrl);

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Etiqueta ${safeCode}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              font-family: Arial, sans-serif;
              color: #173a43;
              background: #ffffff;
            }
            .label {
              width: 320px;
              border: 1px solid #d8d0c4;
              border-radius: 12px;
              padding: 18px;
              text-align: center;
            }
            .code {
              margin-top: 12px;
              font-size: 18px;
              font-weight: 700;
            }
            .title {
              margin-top: 6px;
              font-size: 13px;
            }
            .url {
              margin-top: 10px;
              overflow-wrap: anywhere;
              font-size: 9px;
              color: #637077;
            }
            img { width: 220px; height: 220px; }
          </style>
        </head>
        <body>
          <div class="label">
            <img src="${qrDataUrl}" alt="QR Code ${safeCode}" />
            <div class="code">${safeCode}</div>
            <div class="title">${safeTitle}</div>
            <div class="url">${safeUrl}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 150);
  }

  const modal = (
    <div className="fixed inset-0 z-[99999]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-[rgba(23,58,67,0.66)] backdrop-blur-[3px]" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="glass-panel w-full max-w-xl overflow-hidden rounded-[30px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-6 py-5 [border-color:var(--border-soft)]">
            <div>
              <p className="eyebrow">QR Code</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                {asset.internalCode}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary px-3 py-2 text-sm"
            >
              Fechar
            </button>
          </div>

          <div className="px-6 py-6">
            <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
              <div className="flex h-[18rem] w-full items-center justify-center rounded-[24px] border bg-white p-4 [border-color:var(--border-soft)] md:w-[18rem]">
                {error ? (
                  <div className="status-banner-error rounded-[18px] px-4 py-3 text-sm">
                    {error}
                  </div>
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code do asset ${asset.internalCode}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-sm [color:var(--text-secondary)]">
                    Gerando QR Code...
                  </div>
                )}
              </div>

              <div>
                <div className="status-pill">{asset.internalCode}</div>
                <h3 className="mt-4 text-lg font-semibold [color:var(--text-primary)]">
                  {title || "-"}
                </h3>
                <p className="mt-2 break-all text-sm [color:var(--text-secondary)]">
                  {assetUrl}
                </p>

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={!qrDataUrl}
                  className="btn-primary mt-6 px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Imprimir etiqueta
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="action-button">
        <QrIcon />
        QR Code
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
