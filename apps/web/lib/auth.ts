export const AUTH_TOKEN_KEY = "inventario_ti_token";
export const AUTH_USER_KEY = "inventario_ti_user";

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
}

export function getAuthUser<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(AUTH_USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

export function setAuthUser(user: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_USER_KEY);
}

export type AuthTokenPayload = {
  sub?: string;
  email?: string;
  role?: string;
  name?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

export function decodeAuthToken(token: string): AuthTokenPayload | null {
  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return null;
    }

    return JSON.parse(decodeBase64Url(payload)) as AuthTokenPayload;
  } catch {
    return null;
  }
}
