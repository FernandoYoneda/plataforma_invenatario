"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  ApiError,
  deleteAssetAttachment,
  downloadAssetAttachment,
  getAssetAttachments,
  uploadAssetAttachment,
} from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { AssetAttachment } from "@/lib/types";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(attachment: AssetAttachment) {
  return attachment.mimeType.startsWith("image/");
}

function validateFile(file: File) {
  if (file.size <= 0) {
    return "Arquivo vazio nao e permitido.";
  }

  if (file.size > MAX_FILE_SIZE) {
    return "Arquivo excede o limite de 10MB.";
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "Tipo de arquivo nao permitido.";
  }

  return null;
}

export default function AssetAttachmentsPanel({
  assetId,
  isAdmin,
  onUnauthorized,
}: {
  assetId: string;
  isAdmin: boolean;
  onUnauthorized: () => void;
}) {
  const [attachments, setAttachments] = useState<AssetAttachment[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function handleApiError(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.status === 401) {
      onUnauthorized();
      return "Sessao expirada. Faca login novamente.";
    }

    if (err instanceof ApiError && err.status === 403) {
      return "Acesso restrito a administradores.";
    }

    return err instanceof Error ? err.message : fallback;
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const token = getAuthToken();

      if (!token) {
        onUnauthorized();
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await getAssetAttachments(assetId, token);
        if (!active) return;
        setAttachments(data);
      } catch (err: unknown) {
        if (!active) return;
        setError(handleApiError(err, "Nao foi possivel carregar os anexos."));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [assetId, onUnauthorized]);

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    async function loadPreviews() {
      const token = getAuthToken();

      if (!token) return;

      const imageAttachments = attachments.filter(isImage);
      const entries = await Promise.all(
        imageAttachments.map(async (attachment) => {
          try {
            const blob = await downloadAssetAttachment(
              assetId,
              attachment.id,
              token,
            );
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            return [attachment.id, url] as const;
          } catch {
            return null;
          }
        }),
      );

      if (!active) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setPreviews(
        Object.fromEntries(
          entries.filter((entry): entry is readonly [string, string] =>
            Boolean(entry),
          ),
        ),
      );
    }

    setPreviews({});
    loadPreviews();

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [assetId, attachments]);

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setUploadError(file ? validateFile(file) : null);
  }

  async function handleUpload() {
    if (!selectedFile) {
      setUploadError("Selecione um arquivo para anexar.");
      return;
    }

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      onUnauthorized();
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const attachment = await uploadAssetAttachment(assetId, selectedFile, token);
      setAttachments((current) => [attachment, ...current]);
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err: unknown) {
      setUploadError(handleApiError(err, "Nao foi possivel enviar o anexo."));
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(attachment: AssetAttachment) {
    const token = getAuthToken();
    if (!token) {
      onUnauthorized();
      return;
    }

    setDownloadingId(attachment.id);
    setError(null);

    try {
      const blob = await downloadAssetAttachment(assetId, attachment.id, token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 500);
    } catch (err: unknown) {
      setError(handleApiError(err, "Nao foi possivel baixar o anexo."));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(attachment: AssetAttachment) {
    if (
      !window.confirm(
        `Excluir o anexo "${attachment.originalName}" deste ativo?`,
      )
    ) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      onUnauthorized();
      return;
    }

    setDeletingId(attachment.id);
    setError(null);

    try {
      await deleteAssetAttachment(assetId, attachment.id, token);
      setAttachments((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
    } catch (err: unknown) {
      setError(handleApiError(err, "Nao foi possivel excluir o anexo."));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="glass-panel overflow-hidden rounded-[30px]">
      <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Anexos</p>
            <h2 className="mt-2 text-xl font-semibold [color:var(--text-primary)]">
              Arquivos do ativo
            </h2>
          </div>
          <div className="status-pill">{attachments.length} arquivo(s)</div>
        </div>
      </div>

      <div className="space-y-5 px-6 py-6">
        {isAdmin ? (
          <div className="surface-soft rounded-[24px] px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="block text-sm">
                <span className="font-medium [color:var(--text-primary)]">
                  Novo anexo
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  onChange={onFileChange}
                  accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,.doc,.docx,.xls,.xlsx"
                  className="brand-input mt-1.5"
                  disabled={uploading}
                />
                <span className="mt-2 block text-xs [color:var(--text-secondary)]">
                  {selectedFile ? `Arquivo selecionado: ${selectedFile.name}` : "Nenhum arquivo selecionado."}
                </span>
              </label>

              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !selectedFile}
                className="btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
              >
                {uploading ? "Enviando..." : "Anexar arquivo"}
              </button>
            </div>

            <p className="mt-2 text-xs [color:var(--text-secondary)]">
              Permitidos: imagens, PDF, TXT, DOC/DOCX e XLS/XLSX ate 10MB.
            </p>

            {uploadError ? (
              <div className="status-banner-error mt-3 rounded-[18px] px-4 py-3 text-sm">
                {uploadError}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="surface-soft rounded-[24px] px-4 py-4 text-sm [color:var(--text-secondary)]">
            Upload e exclusao de anexos sao restritos a administradores.
          </div>
        )}

        {error ? (
          <div className="status-banner-error rounded-[22px] px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="text-sm [color:var(--text-secondary)]">
            Carregando anexos...
          </div>
        ) : attachments.length === 0 ? (
          <div className="surface-soft rounded-[24px] px-4 py-4 text-sm [color:var(--text-secondary)]">
            Nenhum anexo cadastrado para este ativo.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="surface-soft overflow-hidden rounded-[24px]"
              >
                {isImage(attachment) ? (
                  <div className="flex h-52 items-center justify-center bg-white">
                    {previews[attachment.id] ? (
                      <img
                        src={previews[attachment.id]}
                        alt={attachment.originalName}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="text-sm [color:var(--text-secondary)]">
                        Carregando preview...
                      </div>
                    )}
                  </div>
                ) : null}

                <div className="px-4 py-4">
                  <div className="break-words font-semibold [color:var(--text-primary)]">
                    {attachment.originalName}
                  </div>
                  <div className="mt-2 grid gap-1 text-sm [color:var(--text-secondary)]">
                    <span>{attachment.mimeType}</span>
                    <span>{formatBytes(attachment.size)}</span>
                    <span>{formatDate(attachment.createdAt)}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(attachment)}
                      disabled={downloadingId === attachment.id}
                      className="btn-secondary px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {downloadingId === attachment.id ? "Baixando..." : "Baixar"}
                    </button>

                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(attachment)}
                        disabled={deletingId === attachment.id}
                        className="btn-danger px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === attachment.id ? "Excluindo..." : "Excluir"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
