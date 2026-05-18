"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createUser,
  getUsers,
  inactivateUser,
  resetUserPassword,
  updateUser,
} from "@/lib/api";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { canManageUsers, roleLabel } from "@/lib/permissions";
import type { SystemUser } from "@/lib/types";
import AppShell from "./AppShell";
import { useAuth } from "./AuthProvider";
import ResetUserPasswordModal from "./ResetUserPasswordModal";
import UserFormModal from "./UserFormModal";

const STATUS_OPTIONS = [
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
  { value: "all", label: "Todos" },
] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function sortUsers(users: SystemUser[]) {
  return [...users].sort((a, b) => {
    if (a.isActive !== b.isActive) {
      return Number(b.isActive) - Number(a.isActive);
    }

    return a.name.localeCompare(b.name, "pt-BR");
  });
}

function normalizeQuery(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function UsersView() {
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("active");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [resetUser, setResetUser] = useState<SystemUser | null>(null);

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

  const isAdmin = canManageUsers(currentUser?.role);

  useEffect(() => {
    async function load() {
      const token = getAuthToken();

      if (!token) {
        setRedirecting(true);
        setLoading(false);
        router.replace("/login");
        return;
      }

      if (!isAdmin) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const data = await getUsers(token, statusFilter);
        setUsers(sortUsers(data));
        setError(null);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Não foi possível carregar usuários.";
        handleAuthError(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      load();
    }
  }, [authLoading, isAdmin, router, statusFilter]);

  const filteredUsers = useMemo(() => {
    const query = normalizeQuery(search.trim());
    if (!query) {
      return users;
    }

    return users.filter((item) => {
      const haystack = normalizeQuery(
        [item.name, item.email, item.role, item.isActive ? "ativo" : "inativo"].join(" "),
      );
      return haystack.includes(query);
    });
  }, [search, users]);

  async function handleCreate(values: {
    name: string;
    email: string;
    password: string;
    role: SystemUser["role"];
  }) {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    const user = await createUser(values, token);
    setUsers((current) => sortUsers([user, ...current]));
    toast.success("Usuário criado com sucesso.");
  }

  async function handleUpdate(values: {
    name: string;
    email: string;
    password: string;
    role: SystemUser["role"];
  }) {
    if (!editUser) return;

    const token = getAuthToken();
    if (!token) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    const updated = await updateUser(
      editUser.id,
      { name: values.name, role: values.role },
      token,
    );

    setUsers((current) =>
      sortUsers(current.map((item) => (item.id === updated.id ? updated : item))),
    );
    toast.success("Usuário atualizado com sucesso.");
  }

  async function handleResetPassword(password: string) {
    if (!resetUser) return;

    const token = getAuthToken();
    if (!token) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    await resetUserPassword(resetUser.id, { password }, token);
    toast.success("Senha redefinida com sucesso.");
  }

  async function handleInactivate(userId: string) {
    const token = getAuthToken();
    if (!token) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }

    const updated = await inactivateUser(userId, token);
    setUsers((current) =>
      sortUsers(current.map((item) => (item.id === updated.id ? updated : item))),
    );
    toast.success("Usuário inativado com sucesso.");
  }

  if (redirecting) {
    return (
      <AppShell
        current="users"
        title="Usuários"
        subtitle="Gestão de acessos do sistema."
        contentSize="compact"
      >
        <section className="surface-card rounded-[30px] px-6 py-10 text-sm [color:var(--text-secondary)]">
          Redirecionando para o login...
        </section>
      </AppShell>
    );
  }

  if (!authLoading && !isAdmin) {
    return (
      <AppShell
        current="users"
        title="Usuários"
        subtitle="Gestão de acessos do sistema."
        contentSize="compact"
      >
        <section className="status-banner-error rounded-[28px] px-6 py-10 text-sm">
          Acesso restrito: apenas administradores podem gerenciar usuários.
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      current="users"
      title="Usuários"
      subtitle="Cadastro, perfis, senha inicial e inativação de usuários do sistema."
      contentSize="wide"
      actions={
        isAdmin ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-primary px-4 py-2.5 text-sm"
          >
            Novo usuário
          </button>
        ) : null
      }
    >
      <section className="overflow-hidden rounded-[30px] border [border-color:var(--border-soft)] bg-[rgba(255,255,255,0.72)] shadow-[0_18px_50px_rgba(23,58,67,0.08)] backdrop-blur">
        <div className="flex flex-col gap-3 border-b px-6 py-5 [border-color:var(--border-soft)] lg:flex-row lg:items-center lg:justify-between">
          <div className="status-pill">
            {loading ? "Carregando..." : `${filteredUsers.length} usuário(s)`}
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatusFilter(item.value)}
                className={
                  statusFilter === item.value
                    ? "btn-secondary [border-color:var(--brand-teal-700)] bg-[rgba(31,75,85,0.08)] px-3 py-2 text-sm"
                    : "btn-secondary px-3 py-2 text-sm"
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
          <label className="block max-w-xl text-sm">
            <span className="font-medium [color:var(--text-primary)]">Buscar</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="brand-input mt-1.5"
              placeholder="Nome, email, perfil ou status"
            />
          </label>
        </div>

        {error ? (
          <div className="status-banner-error m-6 rounded-[22px] px-4 py-4 text-sm">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
            Buscando usuários...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="px-6 py-10 text-sm [color:var(--text-secondary)]">
            Nenhum usuário encontrado com esses filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table data-table-compact">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((item) => (
                  <tr key={item.id}>
                    <td className="cell-strong">
                      <div className="flex flex-col gap-1">
                        <span>{item.name}</span>
                        {currentUser?.id === item.id ? (
                          <span className="status-pill w-fit">Você</span>
                        ) : null}
                      </div>
                    </td>
                    <td>{item.email}</td>
                    <td>{roleLabel(item.role)}</td>
                    <td>
                      <span className="status-pill">
                        {item.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="asset-actions-row justify-start">
                        <button
                          type="button"
                          onClick={() => setEditUser(item)}
                          className="action-button"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setResetUser(item)}
                          className="action-button"
                        >
                          Redefinir senha
                        </button>
                        {item.isActive ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (
                                window.confirm(
                                  `Inativar o usuário ${item.name}?`,
                                )
                              ) {
                                try {
                                  await handleInactivate(item.id);
                                } catch (err: unknown) {
                                  const message =
                                    err instanceof Error
                                      ? err.message
                                      : "Não foi possível inativar o usuário.";
                                  setError(message);
                                }
                              }
                            }}
                            className="action-button border-rose-200 bg-rose-50/90 text-rose-700 hover:bg-rose-100"
                          >
                            Inativar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <UserFormModal
        open={createOpen}
        mode="create"
        title="Novo usuário"
        submitLabel="Criar usuário"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <UserFormModal
        open={Boolean(editUser)}
        mode="edit"
        user={editUser}
        title="Editar usuário"
        submitLabel="Salvar alterações"
        onClose={() => setEditUser(null)}
        onSubmit={handleUpdate}
      />

      <ResetUserPasswordModal
        open={Boolean(resetUser)}
        user={resetUser}
        onClose={() => setResetUser(null)}
        onSubmit={handleResetPassword}
      />
    </AppShell>
  );
}
