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
