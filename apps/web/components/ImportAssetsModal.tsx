"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importAssets } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { canManageAssets } from "@/lib/permissions";
import type { Asset, Category, Location } from "@/lib/types";
import { useAuth } from "./AuthProvider";

type AssetImportField =
  | "internalCode"
  | "type"
  | "brand"
  | "model"
  | "serialNumber"
  | "value"
  | "purchaseDate"
  | "phoneNumber1"
  | "phoneNumber2"
  | "imei1"
  | "imei2"
  | "carrier"
  | "notes"
  | "categoryName"
  | "locationName"
  | "status";

type EditableAssetRow = Record<AssetImportField, string> & {
  rowId: string;
  rowNumber: number;
};

type FieldError = {
  field: AssetImportField;
  message: string;
};

type ValidatedAssetRow = EditableAssetRow & {
  normalizedType: string;
  errors: FieldError[];
  isValid: boolean;
  isIgnored: boolean;
};

type ParsedRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type PreviewState = {
  headers: string[];
  rows: ParsedRow[];
};

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const ASSET_TYPES = [
  ["NOTEBOOK", "Notebook"],
  ["DESKTOP", "Desktop"],
  ["MONITOR", "Monitor"],
  ["MOUSE", "Mouse"],
  ["TECLADO", "Teclado"],
  ["SMARTPHONE", "Smartphone"],
  ["OUTRO", "Outro"],
] as const;

const STATUS_OPTIONS = [
  ["ESTOQUE", "Estoque"],
  ["EM_USO", "Em uso"],
  ["MANUTENCAO", "Manutenção"],
  ["BAIXADO", "Baixado"],
] as const;

const STATUS_ALIASES = new Map<string, string>([
  ["estoque", "ESTOQUE"],
  ["em uso", "EM_USO"],
  ["em_uso", "EM_USO"],
  ["uso", "EM_USO"],
  ["manutencao", "MANUTENCAO"],
  ["manutencao preventiva", "MANUTENCAO"],
  ["baixado", "BAIXADO"],
  ["inativo", "BAIXADO"],
]);

const FIELD_LABELS: Record<AssetImportField, string> = {
  internalCode: "Código",
  type: "Tipo",
  brand: "Marca",
  model: "Modelo",
  serialNumber: "Serial",
  value: "Valor",
  purchaseDate: "Data de compra",
  phoneNumber1: "Telefone 1",
  phoneNumber2: "Telefone 2",
  imei1: "IMEI 1",
  imei2: "IMEI 2",
  carrier: "Operadora",
  notes: "Observações",
  categoryName: "Categoria",
  locationName: "Localização",
  status: "Status",
};

const TYPE_ALIASES = new Map<string, string>([
  ["desktop", "DESKTOP"],
  ["computador", "DESKTOP"],
  ["computador desktop", "DESKTOP"],
  ["pc", "DESKTOP"],
  ["notebook", "NOTEBOOK"],
  ["laptop", "NOTEBOOK"],
  ["monitor", "MONITOR"],
  ["mouse", "MOUSE"],
  ["teclado", "TECLADO"],
  ["keyboard", "TECLADO"],
  ["smartphone", "SMARTPHONE"],
  ["celular", "SMARTPHONE"],
  ["telefone", "SMARTPHONE"],
  ["phone", "SMARTPHONE"],
  ["outro", "OUTRO"],
  ["other", "OUTRO"],
]);

const IMPORT_HEADERS: Record<AssetImportField, string> = {
  internalCode: "codigo",
  type: "tipo",
  brand: "marca",
  model: "modelo",
  serialNumber: "serial",
  value: "valor",
  purchaseDate: "data de compra",
  phoneNumber1: "telefone 1",
  phoneNumber2: "telefone 2",
  imei1: "imei 1",
  imei2: "imei 2",
  carrier: "operadora",
  notes: "observações",
  categoryName: "categoria",
  locationName: "localização",
  status: "status",
};

function normalizeText(value: unknown) {
  if (value === undefined || value === null) return "";

  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function findHeader(headers: string[], aliases: string[]) {
  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    normalized: normalizeText(header),
  }));

  return (
    normalizedHeaders.find((header) =>
      aliases.some((alias) => normalizeText(alias) === header.normalized),
    )?.raw ?? ""
  );
}

function valueByHeader(row: ParsedRow, header: string) {
  if (!header) return "";
  return row.values[header] ?? "";
}

function parseAssetType(value: string) {
  const normalized = normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return TYPE_ALIASES.get(normalized) ?? normalized.toUpperCase();
}

function parseAssetStatus(value: string) {
  const normalized = normalizeText(value)
    .replace(/[^a-z0-9_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return STATUS_ALIASES.get(normalized) ?? normalized.toUpperCase();
}

function parseMoneyToCents(value: string) {
  const text = value.trim();
  if (!text) return null;

  const cleaned = text.replace(/[^\d,.-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const normalized =
    lastComma >= 0 && lastDot >= 0
      ? lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "")
      : cleaned.replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function normalizeImei(value: string) {
  return value.replace(/\D/g, "");
}

function isValidOptionalImei(value: string) {
  const digits = normalizeImei(value);
  return digits.length === 0 || digits.length === 15;
}

function parseDateValue(value: string) {
  const text = value.trim();
  if (!text) return true;

  if (/^\d+(\.\d+)?$/.test(text)) {
    return Boolean(XLSX.SSF.parse_date_code(Number(text)));
  }

  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (br) {
    const [, day, month, year] = br;
    const parsed = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
    );
    return (
      parsed.getUTCFullYear() === Number(year) &&
      parsed.getUTCMonth() === Number(month) - 1 &&
      parsed.getUTCDate() === Number(day)
    );
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const [, year, month, day] = iso;
    const parsed = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), 12),
    );
    return (
      parsed.getUTCFullYear() === Number(year) &&
      parsed.getUTCMonth() === Number(month) - 1 &&
      parsed.getUTCDate() === Number(day)
    );
  }

  return !Number.isNaN(new Date(text).getTime());
}

function excelSerialToBrDate(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value.trim())) return value;

  const parsed = XLSX.SSF.parse_date_code(Number(value));
  if (!parsed) return value;

  return `${String(parsed.d).padStart(2, "0")}/${String(parsed.m).padStart(2, "0")}/${parsed.y}`;
}

function formatWorksheet(sheet: XLSX.WorkSheet, rows: string[][]) {
  sheet["!cols"] = rows[0].map((_, columnIndex) => {
    const width = rows.reduce((max, row) => {
      const cellLength = String(row[columnIndex] ?? "").length;
      return Math.max(max, cellLength);
    }, 0);

    return { wch: Math.min(Math.max(width + 2, 12), 36) };
  });

  for (let columnIndex = 0; columnIndex < rows[0].length; columnIndex += 1) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: columnIndex });
    const cell = sheet[cellAddress];
    if (cell) {
      cell.s = { font: { bold: true } };
    }
  }
}

function downloadXlsxTemplate() {
  const rows = [
    [
      "tipo",
      "marca",
      "modelo",
      "serial",
      "categoria",
      "localização",
      "valor",
      "data de compra",
      "telefone 1",
      "telefone 2",
      "imei 1",
      "imei 2",
      "operadora",
      "status",
      "observações",
    ],
    [
      "Notebook",
      "Dell",
      "Latitude 5440",
      "SN-12345",
      "Notebook",
      "Estoque TI",
      "3500,00",
      "01/06/2026",
      "",
      "",
      "",
      "",
      "",
      "ESTOQUE",
      "Exemplo de cadastro",
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  formatWorksheet(sheet, rows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Ativos");
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    cellStyles: true,
  });
  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "modelo-importacao-ativos.xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function readSpreadsheet(file: File): Promise<PreviewState> {
  const lowerName = file.name.toLowerCase();
  const isCsv = lowerName.endsWith(".csv");
  const isXlsx = lowerName.endsWith(".xlsx");

  if (!isCsv && !isXlsx) {
    throw new Error("Formato inválido. Envie uma planilha .xlsx ou .csv.");
  }

  let workbook: XLSX.WorkBook;

  try {
    workbook = isCsv
      ? XLSX.read(await file.text(), { type: "string" })
      : XLSX.read(await file.arrayBuffer(), { type: "array" });
  } catch {
    throw new Error("Não foi possível ler a planilha.");
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Planilha vazia ou sem aba válida.");
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });

  const headers = (rawRows[0] ?? []).map((value, index) => {
    const header = String(value ?? "").trim();
    return header || `COLUNA_${index + 1}`;
  });

  const rows = rawRows.slice(1).map((values, index) => {
    const rowValues: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      rowValues[header] = String(values?.[headerIndex] ?? "").trim();
    });

    return {
      rowNumber: index + 2,
      values: rowValues,
    };
  });

  if (headers.length === 0 || rows.length === 0) {
    throw new Error("A planilha precisa conter cabeçalho e ao menos uma linha.");
  }

  return { headers, rows };
}

function previewToEditableRows(preview: PreviewState): EditableAssetRow[] {
  const internalCode = findHeader(preview.headers, [
    "codigo",
    "código",
    "codigo interno",
    "código interno",
  ]);
  const type = findHeader(preview.headers, ["tipo"]);
  const brand = findHeader(preview.headers, ["marca"]);
  const model = findHeader(preview.headers, ["modelo"]);
  const serialNumber = findHeader(preview.headers, [
    "serial",
    "serial number",
    "numero de serie",
    "número de série",
  ]);
  const value = findHeader(preview.headers, [
    "valor",
    "valor r$",
    "valor (r$)",
    "preco",
    "preço",
  ]);
  const purchaseDate = findHeader(preview.headers, [
    "data de compra",
    "data compra",
    "purchase date",
    "purchaseDate",
  ]);
  const phoneNumber1 = findHeader(preview.headers, [
    "telefone 1",
    "telefone1",
    "phone 1",
    "phoneNumber1",
  ]);
  const phoneNumber2 = findHeader(preview.headers, [
    "telefone 2",
    "telefone2",
    "phone 2",
    "phoneNumber2",
  ]);
  const imei1 = findHeader(preview.headers, ["imei 1", "imei1"]);
  const imei2 = findHeader(preview.headers, ["imei 2", "imei2"]);
  const carrier = findHeader(preview.headers, ["operadora", "carrier"]);
  const notes = findHeader(preview.headers, [
    "observacoes",
    "observações",
    "observacao",
    "observação",
    "obs",
  ]);
  const categoryName = findHeader(preview.headers, ["categoria"]);
  const locationName = findHeader(preview.headers, [
    "localizacao",
    "localização",
    "local",
  ]);
  const status = findHeader(preview.headers, ["status"]);

  return preview.rows.map((row) => ({
    rowId: `row-${row.rowNumber}`,
    rowNumber: row.rowNumber,
    internalCode: valueByHeader(row, internalCode),
    type: parseAssetType(valueByHeader(row, type)) || valueByHeader(row, type),
    brand: valueByHeader(row, brand),
    model: valueByHeader(row, model),
    serialNumber: valueByHeader(row, serialNumber),
    value: valueByHeader(row, value),
    purchaseDate: excelSerialToBrDate(valueByHeader(row, purchaseDate)),
    phoneNumber1: valueByHeader(row, phoneNumber1),
    phoneNumber2: valueByHeader(row, phoneNumber2),
    imei1: normalizeImei(valueByHeader(row, imei1)),
    imei2: normalizeImei(valueByHeader(row, imei2)),
    carrier: valueByHeader(row, carrier),
    notes: valueByHeader(row, notes),
    categoryName: valueByHeader(row, categoryName),
    locationName: valueByHeader(row, locationName),
    status: parseAssetStatus(valueByHeader(row, status)) || "ESTOQUE",
  }));
}

function isBlankRow(row: EditableAssetRow) {
  return (Object.keys(IMPORT_HEADERS) as AssetImportField[]).every(
    (field) => !row[field].trim(),
  );
}

function validateRows(
  rows: EditableAssetRow[],
  autoGenerateCodes: boolean,
  assets: Asset[],
  categories: Category[],
  locations: Location[],
) {
  const existingCodes = new Set(
    assets.map((asset) => normalizeText(asset.internalCode)),
  );
  const categoryLookup = new Set(
    categories.map((item) => normalizeText(item.name)),
  );
  const locationLookup = new Set(
    locations.map((item) => normalizeText(item.name)),
  );
  const seenCodes = new Set<string>();

  return rows.map((row) => {
    const errors: FieldError[] = [];
    const normalizedType = parseAssetType(row.type);
    const normalizedCode = normalizeText(row.internalCode);
    const ignored = isBlankRow(row);

    if (ignored) {
      return {
        ...row,
        normalizedType,
        errors,
        isValid: false,
        isIgnored: true,
      };
    }

    if (!row.internalCode.trim() && !autoGenerateCodes) {
      errors.push({
        field: "internalCode",
        message: "Código é obrigatório quando a geração automática está desativada.",
      });
    }

    if (row.internalCode.trim()) {
      if (existingCodes.has(normalizedCode)) {
        errors.push({ field: "internalCode", message: "Código já existe." });
      }
      if (seenCodes.has(normalizedCode)) {
        errors.push({
          field: "internalCode",
          message: "Código duplicado na planilha.",
        });
      }
      seenCodes.add(normalizedCode);
    }

    if (!normalizedType) {
      errors.push({ field: "type", message: "Tipo é obrigatório." });
    } else if (!ASSET_TYPES.some(([value]) => value === normalizedType)) {
      errors.push({ field: "type", message: "Tipo inválido." });
    }

    if (!row.brand.trim()) {
      errors.push({ field: "brand", message: "Marca é obrigatória." });
    }

    if (!row.model.trim()) {
      errors.push({ field: "model", message: "Modelo é obrigatório." });
    }

    const valueCents = parseMoneyToCents(row.value);
    if (
      ["DESKTOP", "NOTEBOOK", "MONITOR"].includes(normalizedType) &&
      valueCents == null
    ) {
      errors.push({
        field: "value",
        message: "Valor é obrigatório para Desktop, Notebook e Monitor.",
      });
    }

    if (row.value.trim() && valueCents == null) {
      errors.push({ field: "value", message: "Valor inválido." });
    }

    if (!parseDateValue(row.purchaseDate)) {
      errors.push({ field: "purchaseDate", message: "Data de compra inválida." });
    }

    if (!isValidOptionalImei(row.imei1)) {
      errors.push({ field: "imei1", message: "IMEI 1 deve ter 15 dígitos." });
    }

    if (!isValidOptionalImei(row.imei2)) {
      errors.push({ field: "imei2", message: "IMEI 2 deve ter 15 dígitos." });
    }

    if (row.categoryName.trim() && !categoryLookup.has(normalizeText(row.categoryName))) {
      errors.push({ field: "categoryName", message: "Categoria não encontrada." });
    }

    if (row.locationName.trim() && !locationLookup.has(normalizeText(row.locationName))) {
      errors.push({ field: "locationName", message: "Localização não encontrada." });
    }

    if (
      row.status.trim() &&
      !STATUS_OPTIONS.some(([value]) => value === parseAssetStatus(row.status))
    ) {
      errors.push({ field: "status", message: "Status inválido." });
    }

    return {
      ...row,
      normalizedType,
      status: parseAssetStatus(row.status) || "ESTOQUE",
      errors,
      isValid: errors.length === 0,
      isIgnored: false,
    };
  });
}

function fieldHasError(row: ValidatedAssetRow, field: AssetImportField) {
  return row.errors.some((error) => error.field === field);
}

function fieldInputClass(row: ValidatedAssetRow, field: AssetImportField) {
  return `brand-input min-w-36 text-sm ${
    fieldHasError(row, field) ? "border-rose-400 bg-rose-50/70" : ""
  }`;
}

function buildEditedImportFile(rows: ValidatedAssetRow[]) {
  const headers = (Object.keys(IMPORT_HEADERS) as AssetImportField[]).map(
    (field) => IMPORT_HEADERS[field],
  );
  const dataRows = rows.map((row) => [
    row.internalCode,
    row.normalizedType,
    row.brand,
    row.model,
    row.serialNumber,
    row.value,
    row.purchaseDate,
    row.phoneNumber1,
    row.phoneNumber2,
    normalizeImei(row.imei1),
    normalizeImei(row.imei2),
    row.carrier,
    row.notes,
    row.categoryName,
    row.locationName,
    row.status || "ESTOQUE",
  ]);
  const sheetRows = [headers, ...dataRows];
  const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
  formatWorksheet(sheet, sheetRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Ativos");
  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    cellStyles: true,
  });
  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });

  return new File([blob], "importacao-ativos-editada.xlsx", {
    type: XLSX_MIME_TYPE,
  });
}

export default function ImportAssetsModal({
  assets,
  categories,
  locations,
  onImported,
}: {
  assets: Asset[];
  categories: Category[];
  locations: Location[];
  onImported: (imported: Asset[]) => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [autoGenerateCodes, setAutoGenerateCodes] = useState(true);
  const [editableRows, setEditableRows] = useState<EditableAssetRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<
    Awaited<ReturnType<typeof importAssets>> | null
  >(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [open]);

  const validatedRows = useMemo(
    () => validateRows(editableRows, autoGenerateCodes, assets, categories, locations),
    [assets, autoGenerateCodes, categories, editableRows, locations],
  );

  const ignoredCount = validatedRows.filter((row) => row.isIgnored).length;
  const rowsWithData = validatedRows.filter((row) => !row.isIgnored);
  const validRows = rowsWithData.filter((row) => row.isValid);
  const validCount = validRows.length;
  const invalidCount = rowsWithData.length - validCount;
  const canImport =
    Boolean(file) && validCount > 0 && invalidCount === 0 && !uploading;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setImportResult(null);

    if (!nextFile) {
      setEditableRows([]);
      setPreviewError(null);
      return;
    }

    setLoadingPreview(true);
    setPreviewError(null);

    try {
      const preview = await readSpreadsheet(nextFile);
      setEditableRows(previewToEditableRows(preview));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Não foi possível ler o arquivo.";
      setEditableRows([]);
      setPreviewError(message);
      toast.error(message);
    } finally {
      setLoadingPreview(false);
    }
  }

  function updateRow(rowId: string, field: AssetImportField, value: string) {
    setImportResult(null);
    setEditableRows((current) =>
      current.map((row) =>
        row.rowId === rowId ? { ...row, [field]: value } : row,
      ),
    );
  }

  function resetForm() {
    setFile(null);
    setAutoGenerateCodes(true);
    setEditableRows([]);
    setPreviewError(null);
    setLoadingPreview(false);
    setUploading(false);
    setImportResult(null);
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file || editableRows.length === 0) {
      setPreviewError("Selecione uma planilha válida antes de importar.");
      return;
    }

    if (invalidCount > 0) {
      setPreviewError("Corrija os erros da pré-visualização antes de importar.");
      return;
    }

    if (validRows.length === 0) {
      setPreviewError("Nenhuma linha válida encontrada para importação.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setPreviewError("Sessão expirada. Faça login novamente.");
      return;
    }

    setUploading(true);
    setPreviewError(null);

    try {
      const editedFile = buildEditedImportFile(validRows);
      const result = await importAssets(
        editedFile,
        {
          internalCode: IMPORT_HEADERS.internalCode,
          type: IMPORT_HEADERS.type,
          brand: IMPORT_HEADERS.brand,
          model: IMPORT_HEADERS.model,
          serialNumber: IMPORT_HEADERS.serialNumber,
          valueCents: IMPORT_HEADERS.value,
          purchaseDate: IMPORT_HEADERS.purchaseDate,
          phoneNumber1: IMPORT_HEADERS.phoneNumber1,
          phoneNumber2: IMPORT_HEADERS.phoneNumber2,
          imei1: IMPORT_HEADERS.imei1,
          imei2: IMPORT_HEADERS.imei2,
          carrier: IMPORT_HEADERS.carrier,
          notes: IMPORT_HEADERS.notes,
          categoryName: IMPORT_HEADERS.categoryName,
          locationName: IMPORT_HEADERS.locationName,
          status: IMPORT_HEADERS.status,
        },
        token,
        { autoGenerateCodes },
      );

      setImportResult(result);
      onImported(result.imported);

      toast.success(
        `Importação concluída: ${result.importedCount} importado(s), ${
          result.ignoredCount + ignoredCount
        } ignorado(s).`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Não foi possível importar os ativos.";
      setPreviewError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  if (!canManageAssets(user?.role)) {
    return null;
  }

  const modal = (
    <div className="fixed inset-0 z-[99999]" onClick={() => !uploading && setOpen(false)}>
      <div className="absolute inset-0 bg-[rgba(23,58,67,0.66)] backdrop-blur-[3px]" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="glass-panel w-full max-w-7xl overflow-hidden rounded-[30px]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-6 py-5 [border-color:var(--border-soft)]">
            <div>
              <p className="eyebrow">Importação em massa</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                Importar ativos
              </h2>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!uploading) {
                  setOpen(false);
                }
              }}
              className="btn-secondary px-3 py-2 text-sm"
            >
              Fechar
            </button>
          </div>

          <form onSubmit={handleImport}>
            <div className="max-h-[78vh] overflow-auto px-6 py-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(18rem,25rem)_1fr]">
                <div className="space-y-4">
                  <section className="surface-soft rounded-[24px] px-4 py-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold [color:var(--text-primary)]">
                          Modelo de importação
                        </div>
                        <div className="mt-1 text-xs [color:var(--text-secondary)]">
                          XLSX é o formato recomendado.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={downloadXlsxTemplate}
                        className="btn-secondary px-4 py-2.5 text-sm"
                      >
                        Baixar modelo XLSX
                      </button>
                    </div>

                    <label className="block text-sm">
                      <span className="font-medium [color:var(--text-primary)]">
                        Arquivo XLSX ou CSV
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                        onChange={handleFileChange}
                        className="brand-input mt-1.5"
                        disabled={uploading}
                      />
                    </label>

                    <p className="mt-2 text-xs [color:var(--text-secondary)]">
                      A planilha será aberta para revisão e correção antes da importação.
                    </p>
                    <p className="mt-2 text-xs [color:var(--text-secondary)]">
                      Código vazio será gerado automaticamente quando a opção estiver ativa.
                    </p>
                    <p className="mt-2 text-xs [color:var(--text-secondary)]">
                      {file ? `Arquivo selecionado: ${file.name}` : "Nenhum arquivo selecionado."}
                    </p>

                    <label className="mt-4 flex items-center gap-2 text-sm [color:var(--text-primary)]">
                      <input
                        type="checkbox"
                        checked={autoGenerateCodes}
                        onChange={(event) =>
                          setAutoGenerateCodes(event.target.checked)
                        }
                        disabled={uploading}
                        className="h-4 w-4"
                      />
                      <span>Gerar códigos automaticamente quando vazio</span>
                    </label>
                  </section>

                  <section className="surface-soft rounded-[24px] px-4 py-4">
                    <div className="text-sm font-semibold [color:var(--text-primary)]">
                      Resumo
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                      {[
                        ["Linhas", editableRows.length],
                        ["Válidas", validCount],
                        ["Com erro", invalidCount],
                        ["Ignoradas", ignoredCount],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-[18px] border px-3 py-3 [border-color:var(--border-soft)]"
                        >
                          <div className="text-[var(--text-secondary)]">{label}</div>
                          <div className="mt-1 text-lg font-semibold [color:var(--text-primary)]">
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {previewError ? (
                      <div className="status-banner-error mt-3 rounded-[18px] px-4 py-3 text-sm">
                        {previewError}
                      </div>
                    ) : null}
                  </section>

                  {importResult ? (
                    <section className="surface-soft rounded-[24px] px-4 py-4">
                      <div className="text-sm font-semibold [color:var(--text-primary)]">
                        Resultado
                      </div>
                      <div className="mt-3 text-sm [color:var(--text-secondary)]">
                        {importResult.importedCount} importado(s),{" "}
                        {importResult.ignoredCount + ignoredCount} ignorado(s).
                      </div>
                      {importResult.errors.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          {importResult.errors.slice(0, 20).map((item) => (
                            <div
                              key={`${item.rowNumber}-${item.code ?? "x"}`}
                              className="status-banner-error rounded-[18px] px-4 py-3 text-sm"
                            >
                              Linha {item.rowNumber}
                              {item.code ? ` - ${item.code}` : ""}: {item.message}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </div>

                <section className="surface-soft rounded-[24px] px-4 py-4">
                  <div className="flex flex-col gap-3 border-b pb-4 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold [color:var(--text-primary)]">
                        Pré-visualização editável
                      </div>
                      <div className="mt-1 text-xs [color:var(--text-secondary)]">
                        Corrija os campos diretamente na tabela.
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {loadingPreview ? <span className="status-pill">Lendo...</span> : null}
                      <button
                        type="submit"
                        disabled={!canImport}
                        className="btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {uploading ? "Importando..." : "Confirmar importação"}
                      </button>
                    </div>
                  </div>

                  {editableRows.length > 0 ? (
                    <div className="mt-4 overflow-auto rounded-[20px] border [border-color:var(--border-soft)]">
                      <table className="data-table data-table-compact">
                        <thead>
                          <tr>
                            <th>Linha</th>
                            <th>Código</th>
                            <th>Tipo</th>
                            <th>Marca</th>
                            <th>Modelo</th>
                            <th>Categoria</th>
                            <th>Localização</th>
                            <th>Valor</th>
                            <th>Compra</th>
                            <th>Telefone 1</th>
                            <th>Telefone 2</th>
                            <th>IMEI 1</th>
                            <th>IMEI 2</th>
                            <th>Operadora</th>
                            <th>Status</th>
                            <th>Validação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validatedRows.map((row) => (
                            <tr key={row.rowId}>
                              <td className="cell-strong">{row.rowNumber}</td>
                              <td>
                                <input
                                  value={row.internalCode}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "internalCode", event.target.value)
                                  }
                                  className={fieldInputClass(row, "internalCode")}
                                  placeholder={autoGenerateCodes ? "Automático" : ""}
                                />
                              </td>
                              <td>
                                <select
                                  value={row.normalizedType || row.type}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "type", event.target.value)
                                  }
                                  className={fieldInputClass(row, "type")}
                                >
                                  <option value="">Selecione</option>
                                  {ASSET_TYPES.map(([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  value={row.brand}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "brand", event.target.value)
                                  }
                                  className={fieldInputClass(row, "brand")}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.model}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "model", event.target.value)
                                  }
                                  className={fieldInputClass(row, "model")}
                                />
                              </td>
                              <td>
                                <select
                                  value={row.categoryName}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "categoryName", event.target.value)
                                  }
                                  className={fieldInputClass(row, "categoryName")}
                                >
                                  <option value="">Sem categoria</option>
                                  {categories.map((category) => (
                                    <option key={category.id} value={category.name}>
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <select
                                  value={row.locationName}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "locationName", event.target.value)
                                  }
                                  className={fieldInputClass(row, "locationName")}
                                >
                                  <option value="">Sem localização</option>
                                  {locations.map((location) => (
                                    <option key={location.id} value={location.name}>
                                      {location.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  value={row.value}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "value", event.target.value)
                                  }
                                  className={fieldInputClass(row, "value")}
                                  placeholder="3500,00"
                                />
                              </td>
                              <td>
                                <input
                                  value={row.purchaseDate}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "purchaseDate", event.target.value)
                                  }
                                  className={fieldInputClass(row, "purchaseDate")}
                                  placeholder="DD/MM/AAAA"
                                />
                              </td>
                              <td>
                                <input
                                  value={row.phoneNumber1}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "phoneNumber1", event.target.value)
                                  }
                                  className={fieldInputClass(row, "phoneNumber1")}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.phoneNumber2}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "phoneNumber2", event.target.value)
                                  }
                                  className={fieldInputClass(row, "phoneNumber2")}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.imei1}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "imei1", normalizeImei(event.target.value))
                                  }
                                  className={fieldInputClass(row, "imei1")}
                                  inputMode="numeric"
                                  maxLength={15}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.imei2}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "imei2", normalizeImei(event.target.value))
                                  }
                                  className={fieldInputClass(row, "imei2")}
                                  inputMode="numeric"
                                  maxLength={15}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.carrier}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "carrier", event.target.value)
                                  }
                                  className={fieldInputClass(row, "carrier")}
                                />
                              </td>
                              <td>
                                <select
                                  value={row.status}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "status", event.target.value)
                                  }
                                  className={fieldInputClass(row, "status")}
                                >
                                  {STATUS_OPTIONS.map(([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                {row.isIgnored ? (
                                  <span className="status-pill">Ignorada</span>
                                ) : row.isValid ? (
                                  <span className="status-pill">OK</span>
                                ) : (
                                  <div className="space-y-1 text-xs text-rose-700">
                                    {row.errors.map((error) => (
                                      <div
                                        key={`${row.rowId}-${error.field}-${error.message}`}
                                        className="rounded-full bg-rose-100 px-2.5 py-1"
                                      >
                                        {FIELD_LABELS[error.field]}: {error.message}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[20px] border border-dashed px-4 py-10 text-center text-sm [border-color:var(--border-soft)] [color:var(--text-secondary)]">
                      Selecione uma planilha para visualizar os dados.
                    </div>
                  )}
                </section>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm [color:var(--text-secondary)]">
                {file ? "Revise e corrija os dados antes de importar." : "Selecione um arquivo para continuar."}
              </div>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setOpen(false);
                }}
                className="btn-secondary px-4 py-3 text-sm"
                disabled={uploading}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          resetForm();
          setOpen(true);
          setPreviewError(null);
          setImportResult(null);
        }}
        className="btn-secondary px-4 py-2.5 text-sm"
      >
        Importar ativos
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
