import type { Asset, CreateAssetInput } from "./types";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
};

type LoginResponse = {
  accessToken: string;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseErrorMessage(res: Response) {
  try {
    const maybe = await res.json();

    if (maybe?.message) {
      return Array.isArray(maybe.message)
        ? maybe.message.join(", ")
        : String(maybe.message);
    }
  } catch {
    // Ignora resposta sem JSON.
  }

  return `Falha na requisição (HTTP ${res.status})`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  return res.json() as Promise<T>;
}

export async function login(payload: {
  email: string;
  password: string;
}) {
  const response = await request<
    | LoginResponse
    | {
        token?: string;
        access_token?: string;
      }
  >("/auth/login", {
    method: "POST",
    body: payload,
  });

  const accessToken =
    "accessToken" in response
      ? response.accessToken
      : response.access_token ?? response.token;

  if (!accessToken) {
    throw new ApiError("Resposta de login sem token.", 500);
  }

  return { accessToken };
}

export async function getAssets(token?: string | null) {
  return request<Asset[]>("/assets", {
    method: "GET",
    token,
  });
}

export async function createAsset(
  payload: CreateAssetInput,
  token?: string | null,
) {
  return request<Asset>("/assets", {
    method: "POST",
    body: payload,
    token,
  });
}
