"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, getAsset, getAssetHistory, getCurrentUser } from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { Asset, Assignment } from "@/lib/types";
import AppShell from "../../../components/AppShell";
import AssetAttachmentsPanel from "../../../components/AssetAttachmentsPanel";
import AssetQrCodeModal, {
  assetQrTitle,
  printAssetQrLabel,
} from "../../../components/AssetQrCodeModal";

const TYPE_LABELS: Record<Asset["type"], string> = {
  DESKTOP: "Desktop",
  NOTEBOOK: "Notebook",
  MONITOR: "Monitor",
  MOUSE: "Mouse",
  TECLADO: "Teclado",
  OUTRO: "Outro",
};

const STATUS_LABELS: Record<Asset["status"], string> = {
  EM_USO: "Em uso",
  ESTOQUE: "Estoque",
  MANUTENCAO: "Manutencao",
  BAIXADO: "Baixado",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function fieldValue(value?: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="surface-soft rounded-[22px] px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.08em] [color:var(--text-muted)]">
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-semibold [color:var(--text-primary)]">
        {value}
      </div>
    </div>
  );
}

export default function AssetDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assetId = params.id;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [assetUrl, setAssetUrl] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setAssetUrl(new URL(`/assets/${assetId}`, window.location.origin).toString());
  }, [assetId]);

  const handleUnauthorized = useCallback(() => {
    clearAuthToken();
    setRedirecting(true);
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      const token = getAuthToken();

      if (!token) {
        handleUnauthorized();
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [assetData, historyData, userData] = await Promise.all([
          getAsset(assetId, token),
          getAssetHistory(assetId, token),
          getCurrentUser(token),
        ]);

        if (!active) return;
        setAsset(assetData);
        setHistory(historyData);
        setIsAdmin(userData.role === "ADMIN");
      } catch (err: unknown) {
        if (!active) return;

        if (err instanceof ApiError && err.status === 401) {
          handleUnauthorized();
          return;
        }

        if (err instanceof ApiError && err.status === 404) {
          setError("Ativo nao encontrado.");
          setAsset(null);
          setHistory([]);
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Nao foi possivel carregar este ativo.",
        );
        setAsset(null);
        setHistory([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      active = false;
    };
  }, [assetId, handleUnauthorized]);

  const title = useMemo(() => (asset ? assetQrTitle(asset) : ""), [asset]);

  async function handlePrintQr() {
    if (!asset || !assetUrl) return;

    setPrinting(true);
    setPrintError(null);

    try {
      await printAssetQrLabel(asset, assetUrl);
    } catch (err: unknown) {
      setPrintError(
        err instanceof Error
          ? err.message
          : "Nao foi possivel imprimir a etiqueta.",
      );
    } finally {
      setPrinting(false);
    }
  }

  const actions = (
    <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
      <Link href="/assets" className="btn-secondary px-4 py-2.5 text-sm">
        Voltar para Assets
      </Link>

      {asset ? (
        <>
          <button
            type="button"
            onClick={handlePrintQr}
            disabled={printing}
            className="btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
          >
            {printing ? "Preparando..." : "Imprimir etiqueta QR"}
          </button>

          <AssetQrCodeModal asset={asset} />
        </>
      ) : null}
    </div>
  );

  return (
    <AppShell
      current="assets"
      title={asset ? asset.internalCode : "Detalhe do Asset"}
      subtitle={
        asset
          ? title || "Consulta detalhada do ativo"
          : "Consulta detalhada do ativo e historico de movimentacoes."
      }
      contentSize="standard"
      actions={actions}
    >
      {redirecting ? (
        <section className="glass-panel rounded-[30px] px-6 py-8 text-sm [color:var(--text-secondary)]">
          Redirecionando para o login...
        </section>
      ) : loading ? (
        <section className="glass-panel rounded-[30px] px-6 py-8 text-sm [color:var(--text-secondary)]">
          Carregando asset...
        </section>
      ) : error ? (
        <section className="glass-panel rounded-[30px] px-6 py-8">
          <div className="status-banner-error rounded-[22px] px-4 py-4 text-sm">
            <div className="font-semibold">Nao foi possivel carregar o ativo</div>
            <div className="mt-1">{error}</div>
          </div>
        </section>
      ) : asset ? (
        <>
          {printError ? (
            <div className="status-banner-error rounded-[22px] px-4 py-3 text-sm">
              {printError}
            </div>
          ) : null}

          <section className="glass-panel overflow-hidden rounded-[30px]">
            <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="eyebrow">Asset</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                    {asset.internalCode}
                  </h2>
                  <p className="mt-2 text-sm [color:var(--text-secondary)]">
                    {title || "-"}
                  </p>
                </div>

                <div className="status-pill">{STATUS_LABELS[asset.status]}</div>
              </div>
            </div>

            <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 xl:grid-cols-3">
              <DetailItem label="Codigo interno" value={asset.internalCode} />
              <DetailItem label="Tipo" value={TYPE_LABELS[asset.type]} />
              <DetailItem label="Marca" value={asset.brand} />
              <DetailItem label="Modelo" value={fieldValue(asset.model)} />
              <DetailItem label="Serial" value={fieldValue(asset.serialNumber)} />
              <DetailItem label="Status" value={STATUS_LABELS[asset.status]} />
              <DetailItem
                label="Categoria"
                value={fieldValue(asset.category?.name)}
              />
              <DetailItem
                label="Localização"
                value={fieldValue(asset.location?.name)}
              />
              <DetailItem
                label="Criado em"
                value={formatDate(asset.createdAt ?? asset.registeredAt)}
              />
              <DetailItem
                label="Atualizado em"
                value={formatDate(asset.updatedAt)}
              />
            </div>

            <div className="border-t px-6 py-5 [border-color:var(--border-soft)]">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] [color:var(--text-muted)]">
                Observacoes
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm [color:var(--text-secondary)]">
                {fieldValue(asset.notes)}
              </p>
            </div>
          </section>

          <AssetAttachmentsPanel
            assetId={asset.id}
            isAdmin={isAdmin}
            onUnauthorized={handleUnauthorized}
          />

          <section className="glass-panel overflow-hidden rounded-[30px]">
            <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="eyebrow">Historico</p>
                  <h2 className="mt-2 text-xl font-semibold [color:var(--text-primary)]">
                    Atribuicoes
                  </h2>
                </div>
                <div className="status-pill">{history.length} registro(s)</div>
              </div>
            </div>

            <div className="px-6 py-6">
              {history.length === 0 ? (
                <div className="surface-soft rounded-[24px] px-4 py-4 text-sm [color:var(--text-secondary)]">
                  Este asset ainda nao possui atribuicoes registradas.
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="surface-soft rounded-[24px] px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-semibold [color:var(--text-primary)]">
                            {assignment.employee?.name ??
                              assignment.employeeId ??
                              "Funcionario removido"}
                          </div>
                          <div className="mt-1 text-sm [color:var(--text-secondary)]">
                            {assignment.employee?.email ?? "Funcionario removido"}
                          </div>
                        </div>
                        <div className="status-pill">
                          {assignment.returnedAt ? "Devolvido" : "Ativo"}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm [color:var(--text-secondary)] sm:grid-cols-2">
                        <div>
                          <span className="font-semibold [color:var(--text-primary)]">
                            Atribuido em:
                          </span>{" "}
                          {formatDate(assignment.assignedAt)}
                        </div>
                        <div>
                          <span className="font-semibold [color:var(--text-primary)]">
                            Devolvido em:
                          </span>{" "}
                          {formatDate(assignment.returnedAt)}
                        </div>
                      </div>

                      <div className="mt-3 text-sm [color:var(--text-secondary)]">
                        <span className="font-semibold [color:var(--text-primary)]">
                          Observacoes:
                        </span>{" "}
                        {fieldValue(assignment.notes)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
