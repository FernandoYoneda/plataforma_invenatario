"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
}) {
  const router = useRouter();
  const [items, setItems] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

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

  useEffect(() => {
    async function load() {
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
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [getItems, router]);

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
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="cell-strong">{item.name}</td>
                    <td>{item.description ?? "-"}</td>
                    <td>{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
