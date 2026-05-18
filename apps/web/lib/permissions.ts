export type AppRole = "ADMIN" | "TI" | "GESTOR" | "LEITURA";

export type LegacyRole = "OPERADOR" | "CONSULTA";

export type AnyAppRole = AppRole | LegacyRole;

export function normalizeRole(role?: string | null): AppRole | null {
  switch (role) {
    case "ADMIN":
    case "TI":
    case "GESTOR":
    case "LEITURA":
      return role;
    case "OPERADOR":
      return "TI";
    case "CONSULTA":
      return "LEITURA";
    default:
      return null;
  }
}

export function roleLabel(role?: string | null) {
  const normalized = normalizeRole(role);

  switch (normalized) {
    case "ADMIN":
      return "Administrador";
    case "TI":
      return "TI";
    case "GESTOR":
      return "Gestor";
    case "LEITURA":
      return "Leitura";
    default:
      return "Sem perfil";
  }
}

export function canManageAssets(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized === "ADMIN" || normalized === "TI";
}

export function canManageEmployees(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized === "ADMIN" || normalized === "TI";
}

export function canManageAssignments(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized === "ADMIN" || normalized === "TI";
}

export function canManageReferences(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized === "ADMIN" || normalized === "TI";
}

export function canManageAttachments(role?: string | null) {
  const normalized = normalizeRole(role);
  return normalized === "ADMIN" || normalized === "TI";
}

export function canExportReports(role?: string | null) {
  const normalized = normalizeRole(role);
  return (
    normalized === "ADMIN" ||
    normalized === "TI" ||
    normalized === "GESTOR"
  );
}

