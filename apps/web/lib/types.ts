export type AssetType =
  | "DESKTOP"
  | "NOTEBOOK"
  | "MONITOR"
  | "MOUSE"
  | "TECLADO"
  | "SMARTPHONE"
  | "OUTRO";

export type AssetStatus =
  | "EM_USO"
  | "ESTOQUE"
  | "MANUTENCAO"
  | "BAIXADO";

export type AssetTypeInput =
  | AssetType
  | "Desktop"
  | "Notebook"
  | "Monitor"
  | "Mouse"
  | "Teclado"
  | "Smartphone"
  | "Celular"
  | "Outro"
  | "Computador"
  | "Computador (Desktop)";

export type AssetMoneyInput = string | number | null;

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
  locationId?: string | null;
  location?: Location | null;
  isActive: boolean;
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
  purchaseDate?: string | null;
  phoneNumber1?: string | null;
  phoneNumber2?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  carrier?: string | null;
  status: AssetStatus;
  registeredAt: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string | null;
  categoryId?: string | null;
  locationId?: string | null;
  category?: Category | null;
  location?: Location | null;
};

export type AssetAttachment = {
  id: string;
  assetId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  filePath: string;
  createdAt: string;
};

export type Assignment = {
  id: string;
  assetId: string;
  employeeId: string | null;
  assignedAt: string;
  returnedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  asset?: Asset;
  employee?: Employee | null;
};

export type BulkAssignmentIssue = {
  assetId: string;
  internalCode?: string | null;
  message: string;
};

export type BulkAssignmentResult = {
  assignedCount: number;
  ignoredCount: number;
  errorCount: number;
  assigned: Assignment[];
  ignored: BulkAssignmentIssue[];
  errors: BulkAssignmentIssue[];
};

export type CreateAssetInput = {
  type: AssetTypeInput;
  brand: string;
  model?: string | null;
  serialNumber?: string | null;
  serial?: string | null;
  assetSerial?: string | null;
  valueCents?: number | null;
  valueInCents?: AssetMoneyInput;
  purchaseValueCents?: AssetMoneyInput;
  purchaseValueInCents?: AssetMoneyInput;
  value?: AssetMoneyInput;
  purchaseValue?: AssetMoneyInput;
  purchaseDate?: string | null;
  phoneNumber1?: string | null;
  phoneNumber2?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  carrier?: string | null;
  status?: AssetStatus;
  notes?: string | null;
  categoryId?: string | null;
  locationId?: string | null;
};

export type UpdateAssetInput = {
  type?: AssetTypeInput;
  brand?: string;
  model?: string | null;
  serialNumber?: string | null;
  serial?: string | null;
  assetSerial?: string | null;
  status?: AssetStatus;
  valueCents?: number | null;
  valueInCents?: AssetMoneyInput;
  purchaseValueCents?: AssetMoneyInput;
  purchaseValueInCents?: AssetMoneyInput;
  value?: AssetMoneyInput;
  purchaseValue?: AssetMoneyInput;
  purchaseDate?: string | null;
  phoneNumber1?: string | null;
  phoneNumber2?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  carrier?: string | null;
  notes?: string | null;
  categoryId?: string | null;
  locationId?: string | null;
};

export type CreateEmployeeInput = {
  name: string;
  email: string;
  department?: string | null;
  position?: string | null;
  locationId: string;
};

export type UpdateEmployeeInput = {
  name?: string;
  email?: string;
  department?: string | null;
  position?: string | null;
  locationId: string;
};

export type CreateCategoryInput = {
  name: string;
  description?: string | null;
};

export type CreateLocationInput = {
  name: string;
  description?: string | null;
};

export type CreateAssignmentInput = {
  assetId: string;
  employeeId: string;
  notes?: string | null;
};

export type ReturnAssignmentInput = {
  notes?: string | null;
};

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  userId?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
};

export type AssetDetails = {
  asset: Asset;
  currentAssignment: Assignment | null;
  history: Assignment[];
  auditLogs: AuditLog[];
};

export type AssetImportError = {
  rowNumber: number;
  code?: string | null;
  message: string;
};

export type AssetImportResult = {
  totalRows: number;
  importedCount: number;
  ignoredCount: number;
  errors: AssetImportError[];
  imported: Asset[];
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TI" | "GESTOR" | "LEITURA" | "OPERADOR" | "CONSULTA";
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type SystemUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TI" | "GESTOR" | "LEITURA" | "OPERADOR" | "CONSULTA";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
