"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import AppShell from "./AppShell";
import NewReferenceModal from "./NewReferenceModal";

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

function sortByName<TItem extends ReferenceItem>(items: TItem[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("pt-BR");
}

export default function ReferenceDataView<TItem extends ReferenceItem>({
  current,
  title,
  subtitle,
  countLabel,
  loadingText,
  emptyText,
  buttonLabel,
  modalTitle,
  createLabel,
  successMessage,
  namePlaceholder,
  descriptionPlaceholder,
  getItems,
  createItem,
  deleteItem,
}: {
  current: "categories" | "locations";
  title: string;
  subtitle: string;
  countLabel: string;
  loadingText: string;
  emptyText: string;
  buttonLabel: string;
  modalTitle: string;
  createLabel: string;
  successMessage: string;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  getItems: (token?: string | null) => Promise<TItem[]>;
  createItem: (
    payload: CreateReferenceInput,
    token?: string | null,
  ) => Promise<TItem>;
  deleteItem?: (
    itemId: string,
    token?: string | null,
  ) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const [items, setItems] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  function handleAuthError(err: unknown) {
    if (
      err instanceof Error &&
      "status" in err &&
      typeof err.status === "number" &&
      err.status === 401
    ) {
      clearAuthToken();
      setRedirecting(true);
      router.replace("/login");
      return true;
    }

    return false;
  }

  async function reloadItems() {
    const token = getAuthToken();

    if (!token) {
      setRedirecting(true);
      setLoading(false);
      router.replace("/login");
      return;
    }

    try {
      const data = await getItems(token);
      setItems(sortByName(data));
      setError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nao foi possivel carregar os dados.";

      handleAuthError(err);
      setError(message);
    }
  }

  useEffect(() => {
    async function load() {
      await reloadItems();
      setLoading(false);
    }

    load();
  }, [getItems, router]);

  async function handleDelete() {
    if (!itemToDelete || !deleteItem) return;

    const token = getAuthToken();

    if (!token) {
      setRedirecting(true);
      router.replace("/login");
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteItem(itemToDelete.id, token);
      setItems((currentItems) =>
        sortByName(currentItems.filter((item) => item.id !== itemToDelete.id)),
      );
      toast.success("Excluido com sucesso.");
      setItemToDelete(null);
      await reloadItems();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nao foi possivel excluir.";
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  const hasDeleteAction = Boolean(deleteItem);

  return (
    <AppShell
      current={current}
      title={title}
      subtitle={subtitle}
      contentSize="compact"
      actions={
        <NewReferenceModal
          buttonLabel={buttonLabel}
          title={modalTitle}
          createLabel={createLabel}
          successMessage={successMessage}
          namePlaceholder={namePlaceholder}
          descriptionPlaceholder={descriptionPlaceholder}
          createItem={createItem}
          onCreated={(item) => {
            setItems((currentItems) => sortByName([...currentItems, item]));
            setError(null);
          }}
        />
      }
    >
      <section className="overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
        <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
          <div className="status-pill">
            {redirecting
              ? "Redirecionando..."
              : loading
                ? "Carregando..."
                : `${items.length} ${countLabel}`}
          </div>
        </div>

        {redirecting ? (
          <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
            Redirecionando para o login...
          </div>
        ) : error ? (
          <div className="status-banner-error m-6 rounded-[22px] px-4 py-4 text-sm">
            {error}
          </div>
        ) : loading ? (
          <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
            {loadingText}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
            {emptyText}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table data-table-compact">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Descricao</th>
                  <th>Criado em</th>
                  {hasDeleteAction ? (
                    <th className="text-right">Acoes</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="cell-strong">{item.name}</td>
                    <td>{item.description ?? "-"}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    {hasDeleteAction ? (
                      <td className="text-right">
                        <div className="asset-actions-row justify-end">
                          {current === "locations" ? (
                            <Link
                              href={`/assets?locationId=${encodeURIComponent(item.id)}`}
                              className="action-button action-button-compact"
                              title="Ver ativos desta localizacao"
                            >
                              Ver ativos
                            </Link>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setItemToDelete(item);
                            }}
                            className="action-button action-button-compact"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mounted && itemToDelete && deleteItem
        ? createPortal(
            <div className="fixed inset-0 z-[99999]">
              <div className="absolute inset-0 bg-[rgba(23,58,67,0.66)] backdrop-blur-[3px]" />
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="glass-panel w-full max-w-xl overflow-hidden rounded-[30px]">
                  <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
                    <p className="eyebrow">Confirmacao</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                      Excluir {itemToDelete.name}
                    </h2>
                    <p className="mt-2 text-sm [color:var(--text-secondary)]">
                      {current === "locations"
                        ? "Esta localizacao so pode ser removida se nao houver ativos ou funcionarios vinculados."
                        : "Esta categoria so pode ser removida se nao houver ativos vinculados."}
                    </p>
                  </div>

                  <div className="px-6 py-5">
                    {deleteError ? (
                      <div className="status-banner-error rounded-[22px] px-4 py-3 text-sm">
                        {deleteError}
                      </div>
                    ) : null}
                    <div className="mt-4 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setItemToDelete(null)}
                        disabled={deleting}
                        className="btn-secondary px-4 py-3 text-sm disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="btn-danger px-4 py-3 text-sm disabled:opacity-70"
                      >
                        {deleting ? "Excluindo..." : "Excluir"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </AppShell>
  );
}
