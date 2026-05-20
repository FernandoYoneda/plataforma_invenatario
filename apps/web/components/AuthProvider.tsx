"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCurrentUser } from "@/lib/api";
import {
  clearAuthToken,
  clearAuthUser,
  decodeAuthToken,
  getAuthToken,
  getAuthUser,
  setAuthUser,
} from "@/lib/auth";
import type { AuthUser } from "@/lib/types";
import { normalizeRole, type AppRole } from "@/lib/permissions";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  loadingAuth: boolean;
  error: string | null;
  refreshUser: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      const token = getAuthToken();

      if (!token) {
        if (active) {
          setUser(null);
          clearAuthUser();
          setError(null);
          setLoadingAuth(false);
        }
        return;
      }

      setLoadingAuth(true);
      setError(null);

      try {
        const current = await getCurrentUser(token);
        if (!active) return;

        const nextUser = {
          ...current,
          role: normalizeRole(current.role) ?? "LEITURA",
        } satisfies AuthUser;

        setUser(nextUser);
        setAuthUser(nextUser);
      } catch (err: unknown) {
        if (!active) return;

        if (
          err instanceof Error &&
          "status" in err &&
          typeof err.status === "number" &&
          err.status === 401
        ) {
          clearAuthToken();
          clearAuthUser();
          setError(null);
          setUser(null);
          setLoadingAuth(false);
          return;
        }

        const tokenPayload = decodeAuthToken(token);
        const cached = getAuthUser<AuthUser>();
        const fallbackUser = tokenPayload
          ? {
              id: tokenPayload.sub ?? "",
              name: tokenPayload.name ?? tokenPayload.email ?? "Usuario",
              email: tokenPayload.email ?? "",
              role: normalizeRole(tokenPayload.role) ?? "LEITURA",
              isActive: tokenPayload.isActive ?? true,
              createdAt: tokenPayload.createdAt,
              updatedAt: tokenPayload.updatedAt,
            }
            : cached
              ? {
                  ...cached,
                  role: normalizeRole(cached.role) ?? "LEITURA",
                }
              : null;

        if (fallbackUser) {
          setUser(fallbackUser);
          setError("Nao foi possivel atualizar o perfil no momento.");
        } else {
          setUser(null);
          setError("Nao foi possivel carregar o perfil no momento.");
        }
      } finally {
        if (active) {
          setLoadingAuth(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: loadingAuth,
      loadingAuth,
      error,
      refreshUser: () => setRefreshKey((current) => current + 1),
    }),
    [error, loadingAuth, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export type { AppRole };
