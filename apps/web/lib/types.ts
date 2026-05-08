export type AssetType =
  | "DESKTOP"
  | "NOTEBOOK"
  | "MONITOR"
  | "MOUSE"
  | "TECLADO"
  | "OUTRO";

export type AssetStatus =
  | "EM_USO"
  | "ESTOQUE"
  | "MANUTENCAO"
  | "BAIXADO";

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Location = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Employee = {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  position?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Asset = {
  id: string;
  internalCode: string;
  type: AssetType;
  brand: string;
  model?: string | null;
  serialNumber?: string | null;
  valueCents?: number | null;
  status: AssetStatus;
  registeredAt: string;
  notes?: string | null;
};

export type Assignment = {
  id: string;
  assetId: string;
  employeeId: string;
  assignedAt: string;
  returnedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  asset?: Asset;
  employee?: Employee;
};

export type CreateAssetInput = {
  type: AssetType;
  brand: string;
  model?: string | null;
  serialNumber?: string | null;
  valueCents?: number | null;
  status?: AssetStatus;
  notes?: string | null;
  categoryId?: string;
  locationId?: string;
};

export type CreateEmployeeInput = {
  name: string;
  email: string;
  department?: string | null;
  position?: string | null;
};

export type CreateAssignmentInput = {
  assetId: string;
  employeeId: string;
  notes?: string | null;
};

export type ReturnAssignmentInput = {
  notes?: string | null;
};
