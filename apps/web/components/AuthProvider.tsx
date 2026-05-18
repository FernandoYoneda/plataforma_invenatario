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
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import type { AuthUser } from "@/lib/types";
import { normalizeRole, type AppRole } from "@/lib/permissions";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      const token = getAuthToken();

      if (!token) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const current = await getCurrentUser(token);
        if (!active) return;

        setUser({
          ...current,
          role: normalizeRole(current.role) ?? "LEITURA",
        });
      } catch (err: unknown) {
        if (!active) return;

        if (
          err instanceof Error &&
          "status" in err &&
          typeof err.status === "number" &&
          err.status === 401
        ) {
          clearAuthToken();
        }

        setUser(null);
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
  }, [refreshKey]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refreshUser: () => setRefreshKey((current) => current + 1),
    }),
    [loading, user],
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
