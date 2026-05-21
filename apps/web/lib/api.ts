import type {
  AuditLog,
  Asset,
  AssetDetails,
  AssetAttachment,
  Assignment,
  AuthUser,
  Category,
  CreateAssignmentInput,
  CreateAssetInput,
  CreateCategoryInput,
  CreateEmployeeInput,
  CreateLocationInput,
  Employee,
  Location,
  ReturnAssignmentInput,
  AssetImportResult,
  AssetMoneyInput,
  AssetStatus,
  AssetType,
  SystemUser,
  UpdateAssetInput,
  UpdateEmployeeInput,
} from "./types";

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

type AssetWritePayload = {
  type?: AssetType;
  brand?: string;
  model?: string | null;
  serialNumber?: string | null;
  valueCents?: number | null;
  status?: AssetStatus;
  notes?: string | null;
  categoryId?: string | null;
  locationId?: string | null;
};

type AssetImportMappingField =
  | "internalCode"
  | "type"
  | "brand"
  | "model"
  | "serialNumber"
  | "valueCents"
  | "notes"
  | "categoryName"
  | "locationName"
  | "status";

const ASSET_TYPE_ALIASES: Record<string, AssetType> = {
  desktop: "DESKTOP",
  computador: "DESKTOP",
  "computador desktop": "DESKTOP",
  pc: "DESKTOP",
  notebook: "NOTEBOOK",
  laptop: "NOTEBOOK",
  monitor: "MONITOR",
  mouse: "MOUSE",
  teclado: "TECLADO",
  keyboard: "TECLADO",
  outro: "OUTRO",
  other: "OUTRO",
};

const ASSET_IMPORT_MAPPING_FIELDS = new Set<AssetImportMappingField>([
  "internalCode",
  "type",
  "brand",
  "model",
  "serialNumber",
  "valueCents",
  "notes",
  "categoryName",
  "locationName",
  "status",
]);

const ASSET_IMPORT_MAPPING_ALIASES: Record<string, AssetImportMappingField> = {
  serial: "serialNumber",
  assetSerial: "serialNumber",
  value: "valueCents",
  valueInCents: "valueCents",
  purchaseValue: "valueCents",
  purchaseValueCents: "valueCents",
  purchaseValueInCents: "valueCents",
};

function normalizeAssetText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeAssetType(value: unknown) {
  if (typeof value !== "string") return undefined;

  const normalized = normalizeAssetText(value);
  return (
    ASSET_TYPE_ALIASES[normalized] ?? value.trim().toUpperCase()
  ) as AssetType;
}

function readField(source: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    if (
      Object.prototype.hasOwnProperty.call(source, name) &&
      source[name] !== undefined
    ) {
      return source[name];
    }
  }

  return undefined;
}

function normalizeNullableString(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNumberLike(value: AssetMoneyInput) {
  if (value === null) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  const text = value.trim();
  if (!text) return null;

  const cleaned = text.replace(/[^\d,.-]/g, "");
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const normalized =
    lastComma >= 0 && lastDot >= 0
      ? lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeCents(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && value !== null) {
    return undefined;
  }

  const parsed = parseNumberLike(value);
  return parsed == null ? null : Math.round(parsed);
}

function normalizeCurrencyToCents(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && value !== null) {
    return undefined;
  }

  const parsed = parseNumberLike(value);
  return parsed == null ? null : Math.round(parsed * 100);
}

function normalizeAssetWritePayload(
  payload: CreateAssetInput | UpdateAssetInput,
): AssetWritePayload {
  const source = payload as Record<string, unknown>;
  const result: AssetWritePayload = {};

  const type = normalizeAssetType(readField(source, ["type"]));
  if (type !== undefined) {
    result.type = type;
  }

  const brand = readField(source, ["brand"]);
  if (typeof brand === "string") {
    result.brand = brand;
  }

  const model = normalizeNullableString(readField(source, ["model"]));
  if (model !== undefined) {
    result.model = model;
  }

  const serialNumber = normalizeNullableString(
    readField(source, ["serialNumber", "serial", "assetSerial"]),
  );
  if (serialNumber !== undefined) {
    result.serialNumber = serialNumber;
  }

  const centsValue = normalizeCents(
    readField(source, [
      "valueCents",
      "valueInCents",
      "purchaseValueCents",
      "purchaseValueInCents",
    ]),
  );
  const currencyValue = normalizeCurrencyToCents(
    readField(source, ["value", "purchaseValue"]),
  );
  const valueCents = centsValue !== undefined ? centsValue : currencyValue;
  if (valueCents !== undefined) {
    result.valueCents = valueCents;
  }

  const status = readField(source, ["status"]);
  if (typeof status === "string") {
    result.status = status as AssetStatus;
  }

  const notes = normalizeNullableString(readField(source, ["notes"]));
  if (notes !== undefined) {
    result.notes = notes;
  }

  const categoryId = normalizeNullableString(readField(source, ["categoryId"]));
  if (categoryId !== undefined) {
    result.categoryId = categoryId;
  }

  const locationId = normalizeNullableString(readField(source, ["locationId"]));
  if (locationId !== undefined) {
    result.locationId = locationId;
  }

  return result;
}

function normalizeAssetImportMapping(
  mapping: Record<string, string | null | undefined>,
) {
  const result: Partial<Record<AssetImportMappingField, string>> = {};

  for (const [key, value] of Object.entries(mapping)) {
    const importField = key as AssetImportMappingField;
    const target = ASSET_IMPORT_MAPPING_FIELDS.has(importField)
      ? importField
      : ASSET_IMPORT_MAPPING_ALIASES[key];
    const trimmed = typeof value === "string" ? value.trim() : "";

    if (target && trimmed && !result[target]) {
      result[target] = trimmed;
    }
  }

  return result;
}

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

async function requestBlob(
  path: string,
  token?: string | null,
): Promise<Blob> {
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  return res.blob();
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

export async function getCurrentUser(token?: string | null) {
  return request<AuthUser>("/auth/me", {
    method: "GET",
    token,
  });
}

export async function getUsers(
  token?: string | null,
  status: "active" | "inactive" | "all" = "active",
) {
  const suffix = status === "active" ? "?status=active" : `?status=${status}`;

  return request<SystemUser[]>(`/users${suffix}`, {
    method: "GET",
    token,
  });
}

export async function createUser(
  payload: {
    name: string;
    email: string;
    password: string;
    role: SystemUser["role"];
  },
  token?: string | null,
) {
  return request<SystemUser>("/users", {
    method: "POST",
    body: payload,
    token,
  });
}

export async function updateUser(
  userId: string,
  payload: {
    name?: string;
    role?: SystemUser["role"];
  },
  token?: string | null,
) {
  return request<SystemUser>(`/users/${userId}`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export async function inactivateUser(
  userId: string,
  token?: string | null,
) {
  return request<SystemUser>(`/users/${userId}/inactivate`, {
    method: "PATCH",
    token,
  });
}

export async function activateUser(
  userId: string,
  token?: string | null,
) {
  return request<SystemUser>(`/users/${userId}/activate`, {
    method: "PATCH",
    token,
  });
}

export async function resetUserPassword(
  userId: string,
  payload: { password: string },
  token?: string | null,
) {
  return request<SystemUser>(`/users/${userId}/reset-password`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export async function getAssets(token?: string | null) {
  return request<Asset[]>("/assets", {
    method: "GET",
    token,
  });
}

export async function getAsset(assetId: string, token?: string | null) {
  return request<Asset>(`/assets/${assetId}`, {
    method: "GET",
    token,
  });
}

export async function getAssetDetails(
  assetId: string,
  token?: string | null,
) {
  return request<AssetDetails>(`/assets/${assetId}/details`, {
    method: "GET",
    token,
  });
}

export async function getEmployees(token?: string | null) {
  return request<Employee[]>("/employees", {
    method: "GET",
    token,
  });
}

export async function getActiveEmployees(token?: string | null) {
  return request<Employee[]>("/employees?status=active", {
    method: "GET",
    token,
  });
}

export async function getEmployeesList(
  token?: string | null,
  status: "active" | "inactive" | "all" = "active",
) {
  const suffix = status === "active" ? "?status=active" : `?status=${status}`;

  return request<Employee[]>(`/employees${suffix}`, {
    method: "GET",
    token,
  });
}

export async function getEmployeeAssignments(
  employeeId: string,
  token?: string | null,
) {
  return request<Assignment[]>(`/employees/${employeeId}/assignments`, {
    method: "GET",
    token,
  });
}

export async function createEmployee(
  payload: CreateEmployeeInput,
  token?: string | null,
) {
  return request<Employee>("/employees", {
    method: "POST",
    body: payload,
    token,
  });
}

export async function updateEmployee(
  employeeId: string,
  payload: UpdateEmployeeInput,
  token?: string | null,
) {
  return request<Employee>(`/employees/${employeeId}`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export async function inactivateEmployee(
  employeeId: string,
  token?: string | null,
) {
  return request<Employee>(`/employees/${employeeId}/inactivate`, {
    method: "PATCH",
    token,
  });
}

export async function activateEmployee(
  employeeId: string,
  token?: string | null,
) {
  return request<Employee>(`/employees/${employeeId}/activate`, {
    method: "PATCH",
    token,
  });
}

export async function getCategories(token?: string | null) {
  return request<Category[]>("/categories", {
    method: "GET",
    token,
  });
}

export async function createCategory(
  payload: CreateCategoryInput,
  token?: string | null,
) {
  return request<Category>("/categories", {
    method: "POST",
    body: payload,
    token,
  });
}

export async function deleteCategory(
  categoryId: string,
  token?: string | null,
) {
  return request<{ ok: boolean }>(`/categories/${categoryId}`, {
    method: "DELETE",
    token,
  });
}

export async function getLocations(token?: string | null) {
  return request<Location[]>("/locations", {
    method: "GET",
    token,
  });
}

export async function createLocation(
  payload: CreateLocationInput,
  token?: string | null,
) {
  return request<Location>("/locations", {
    method: "POST",
    body: payload,
    token,
  });
}

export async function deleteLocation(
  locationId: string,
  token?: string | null,
) {
  return request<{ ok: boolean }>(`/locations/${locationId}`, {
    method: "DELETE",
    token,
  });
}

export async function createAsset(
  payload: CreateAssetInput,
  token?: string | null,
) {
  return request<Asset>("/assets", {
    method: "POST",
    body: normalizeAssetWritePayload(payload),
    token,
  });
}

export async function importAssets(
  file: File,
  mapping: Record<string, string | null | undefined>,
  token?: string | null,
  options: { autoGenerateCodes?: boolean } = {},
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append(
    "mapping",
    JSON.stringify(normalizeAssetImportMapping(mapping)),
  );
  formData.append(
    "autoGenerateCodes",
    String(options.autoGenerateCodes ?? true),
  );

  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}/assets/import`, {
    method: "POST",
    headers,
    body: formData,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  return res.json() as Promise<AssetImportResult>;
}

export async function updateAsset(
  assetId: string,
  payload: UpdateAssetInput,
  token?: string | null,
) {
  return request<Asset>(`/assets/${assetId}`, {
    method: "PATCH",
    body: normalizeAssetWritePayload(payload),
    token,
  });
}

export async function getActiveAssignments(token?: string | null) {
  return request<Assignment[]>("/assignments/active", {
    method: "GET",
    token,
  });
}

export async function createAssignment(
  payload: CreateAssignmentInput,
  token?: string | null,
) {
  return request<Assignment>("/assignments", {
    method: "POST",
    body: payload,
    token,
  });
}

export async function returnAssignment(
  assignmentId: string,
  payload: ReturnAssignmentInput,
  token?: string | null,
) {
  return request<Assignment>(`/assignments/${assignmentId}/return`, {
    method: "POST",
    body: payload,
    token,
  });
}

export async function getAssetHistory(assetId: string, token?: string | null) {
  return request<Assignment[]>(`/assets/${assetId}/history`, {
    method: "GET",
    token,
  });
}

export async function getAssetAttachments(
  assetId: string,
  token?: string | null,
) {
  return request<AssetAttachment[]>(`/assets/${assetId}/attachments`, {
    method: "GET",
    token,
  });
}

export async function uploadAssetAttachment(
  assetId: string,
  file: File,
  token?: string | null,
) {
  const formData = new FormData();
  formData.append("file", file);

  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE_URL}/assets/${assetId}/attachments`, {
    method: "POST",
    headers,
    body: formData,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new ApiError(await parseErrorMessage(res), res.status);
  }

  return res.json() as Promise<AssetAttachment>;
}

export async function deleteAssetAttachment(
  assetId: string,
  attachmentId: string,
  token?: string | null,
) {
  return request<{ ok: boolean }>(
    `/assets/${assetId}/attachments/${attachmentId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export async function downloadAssetAttachment(
  assetId: string,
  attachmentId: string,
  token?: string | null,
) {
  return requestBlob(
    `/assets/${assetId}/attachments/${attachmentId}/download`,
    token,
  );
}

export async function getAuditLogs(token?: string | null) {
  return request<AuditLog[]>("/audit-logs", {
    method: "GET",
    token,
  });
}
