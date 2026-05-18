import { Role } from '@prisma/client';

export const ALL_APP_ROLES = [
  Role.ADMIN,
  Role.TI,
  Role.GESTOR,
  Role.LEITURA,
] as const;

export const MANAGE_ASSET_ROLES = [Role.ADMIN, Role.TI] as const;
export const MANAGE_EMPLOYEE_ROLES = [Role.ADMIN, Role.TI] as const;
export const MANAGE_ASSIGNMENT_ROLES = [Role.ADMIN, Role.TI] as const;
export const MANAGE_REFERENCE_ROLES = [Role.ADMIN, Role.TI] as const;
export const MANAGE_ATTACHMENT_ROLES = [Role.ADMIN, Role.TI] as const;
export const VIEW_AUDIT_ROLES = [Role.ADMIN, Role.TI, Role.GESTOR, Role.LEITURA] as const;
export const EXPORT_REPORT_ROLES = [Role.ADMIN, Role.TI, Role.GESTOR] as const;

export function normalizeRole(role?: Role | string | null) {
  if (role === Role.OPERADOR) return Role.TI;
  if (role === Role.CONSULTA) return Role.LEITURA;
  if (role === Role.ADMIN) return Role.ADMIN;
  if (role === Role.TI) return Role.TI;
  if (role === Role.GESTOR) return Role.GESTOR;
  if (role === Role.LEITURA) return Role.LEITURA;

  return undefined;
}
