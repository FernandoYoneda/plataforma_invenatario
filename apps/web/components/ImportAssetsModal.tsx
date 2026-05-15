"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { importAssets } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import type { Asset, Category, Location } from "@/lib/types";

type ImportField =
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

type MappingState = Record<ImportField, string>;

type ParsedRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type ValidatedRow = ParsedRow & {
  code: string;
  isValid: boolean;
  errors: string[];
  preview: {
    type: string;
    brand: string;
    model: string;
    serialNumber: string;
    value: string;
    notes: string;
    categoryName: string;
    locationName: string;
    status: string;
  };
};

type PreviewState = {
  headers: string[];
  rows: ParsedRow[];
};

const FIELD_CONFIGS: Array<{
  field: ImportField;
  label: string;
  required: boolean;
  help: string;
}> = [
  {
    field: "internalCode",
    label: "Codigo",
    required: true,
    help: "Codigo interno do asset.",
  },
  {
    field: "type",
    label: "Tipo",
    required: true,
    help: "Desktop, Notebook, Monitor, Mouse, Teclado ou Outro.",
  },
  {
    field: "brand",
    label: "Marca",
    required: true,
    help: "Marca do asset.",
  },
  {
    field: "model",
    label: "Modelo",
    required: true,
    help: "Modelo do asset.",
  },
  {
    field: "categoryName",
    label: "Categoria",
    required: false,
    help: "Nome da categoria existente.",
  },
  {
    field: "locationName",
    label: "LocalizaÃ§Ã£o",
    required: false,
    help: "Nome da localizaÃ§Ã£o existente.",
  },
  {
    field: "serialNumber",
    label: "Serial",
    required: false,
    help: "NÃºmero de sÃ©rie, se houver.",
  },
  {
    field: "valueCents",
    label: "Valor",
    required: false,
    help: "Valor em BRL.",
  },
  {
    field: "notes",
    label: "ObservaÃ§Ãµes",
    required: false,
    help: "ObservaÃ§Ãµes adicionais.",
  },
];

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
  ["outro", "OUTRO"],
  ["other", "OUTRO"],
]);

function normalizeText(value: unknown) {
  if (value === undefined || value === null) return "";

  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseMoneyToCents(value: string) {
  const text = value.trim();
  if (!text) return null;

  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

function parseAssetType(value: string) {
  const normalized = normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return TYPE_ALIASES.get(normalized) ?? normalized.toUpperCase();
}

function inferMapping(headers: string[]): MappingState {
  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    normalized: normalizeText(header),
  }));

  function findHeader(aliases: string[]) {
    return normalizedHeaders.find((header) =>
      aliases.some((alias) => normalizeText(alias) === header.normalized),
    )?.raw ?? "";
  }

  return {
    internalCode: findHeader(["codigo", "cÃ³digo", "codigo interno", "cÃ³digo interno"]),
    type: findHeader(["tipo"]),
    brand: findHeader(["marca"]),
    model: findHeader(["modelo"]),
    serialNumber: findHeader(["serial", "serial number", "numero de serie", "nÃºmero de sÃ©rie"]),
    valueCents: findHeader(["valor", "valor r$", "valor (r$)", "preco", "preÃ§o"]),
    notes: findHeader(["observacoes", "observaÃ§Ãµes", "observacao", "observaÃ§Ã£o", "obs"]),
    categoryName: findHeader(["categoria"]),
    locationName: findHeader(["localizacao", "localização", "local"]),
    status: findHeader(["status"]),
  };
}

async function readSpreadsheet(file: File): Promise<PreviewState> {
  const isCsv =
    file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
  const workbook = isCsv
    ? XLSX.read(await file.text(), { type: "string" })
    : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Arquivo sem planilha valida.");
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
    throw new Error("Arquivo precisa conter cabecalho e ao menos uma linha.");
  }

  return { headers, rows };
}

function valueByMapping(row: ParsedRow, mapping: MappingState, field: ImportField) {
  const header = mapping[field];
  if (!header) return "";
  return row.values[header] ?? "";
}

function validateRows(
  preview: PreviewState,
  mapping: MappingState,
  assets: Asset[],
  categories: Category[],
  locations: Location[],
) {
  const existingCodes = new Set(
    assets.map((asset) => normalizeText(asset.internalCode)),
  );
  const categoryLookup = new Map(
    categories.map((item) => [normalizeText(item.name), item.id]),
  );
  const locationLookup = new Map(
    locations.map((item) => [normalizeText(item.name), item.id]),
  );
  const seenCodes = new Set<string>();

  const rows = preview.rows.map((row) => {
    const errors: string[] = [];
    const code = valueByMapping(row, mapping, "internalCode");
    const typeInput = valueByMapping(row, mapping, "type");
    const brand = valueByMapping(row, mapping, "brand");
    const model = valueByMapping(row, mapping, "model");
    const serialNumber = valueByMapping(row, mapping, "serialNumber");
    const value = valueByMapping(row, mapping, "valueCents");
    const notes = valueByMapping(row, mapping, "notes");
    const categoryName = valueByMapping(row, mapping, "categoryName");
    const locationName = valueByMapping(row, mapping, "locationName");
    const status = valueByMapping(row, mapping, "status");

    if (!code) errors.push("Codigo e obrigatorio");
    if (!typeInput) errors.push("Tipo e obrigatorio");
    if (!brand) errors.push("Marca e obrigatoria");
    if (!model) errors.push("Modelo e obrigatorio");

    const normalizedCode = normalizeText(code);
    if (code) {
      if (existingCodes.has(normalizedCode)) {
        errors.push("Codigo duplicado no banco");
      }

      if (seenCodes.has(normalizedCode)) {
        errors.push("Codigo duplicado na planilha");
      }
    }

    const type = parseAssetType(typeInput);
    if (
      !["DESKTOP", "NOTEBOOK", "MONITOR", "MOUSE", "TECLADO", "OUTRO"].includes(
        type,
      )
    ) {
      errors.push("Tipo invalido");
    }

    const valueCents = parseMoneyToCents(value);
    if (
      ["DESKTOP", "NOTEBOOK", "MONITOR"].includes(type) &&
      valueCents == null
    ) {
      errors.push("Valor e obrigatorio para Desktop, Notebook e Monitor");
    }

    if (categoryName && !categoryLookup.has(normalizeText(categoryName))) {
      errors.push("Categoria nao encontrada");
    }

    if (locationName && !locationLookup.has(normalizeText(locationName))) {
      errors.push("Localizacao nao encontrada");
    }

    if (code) {
      seenCodes.add(normalizedCode);
    }

    return {
      ...row,
      code,
      errors,
      isValid: errors.length === 0,
      preview: {
        type,
        brand,
        model,
        serialNumber,
        value,
        notes,
        categoryName,
        locationName,
        status,
      },
    };
  });

  return rows;
}

function buildDefaultMapping(headers: string[]) {
  return inferMapping(headers);
}

function downloadCsvTemplate() {
  const headers = [
    "codigo",
    "tipo",
    "marca",
    "modelo",
    "serial",
    "categoria",
    "localizacao",
    "valor",
    "status",
    "observacoes",
  ];

  const example = [
    "TI-EXEMPLO-001",
    "Notebook",
    "Dell",
    "Latitude 5440",
    "SN-12345",
    "TI",
    "Matriz",
    "3500,00",
    "ESTOQUE",
    "Exemplo de cadastro",
  ];

  const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
  const csv = XLSX.utils.sheet_to_csv(sheet, { FS: "," });
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
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
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [mapping, setMapping] = useState<MappingState>(() =>
    buildDefaultMapping([]),
  );
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

  const validatedRows = useMemo(() => {
    if (!preview) return [];
    return validateRows(preview, mapping, assets, categories, locations);
  }, [assets, categories, locations, mapping, preview]);

  const validCount = validatedRows.filter((row) => row.isValid).length;
  const invalidCount = validatedRows.length - validCount;
  const canImport = Boolean(file) && validCount > 0 && !uploading;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setImportResult(null);

    if (!nextFile) {
      setPreview(null);
      setMapping(buildDefaultMapping([]));
      setPreviewError(null);
      return;
    }

    setLoadingPreview(true);
    setPreviewError(null);

    try {
      const nextPreview = await readSpreadsheet(nextFile);
      setPreview(nextPreview);
      setMapping(buildDefaultMapping(nextPreview.headers));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nao foi possivel ler o arquivo.";
      setPreview(null);
      setPreviewError(message);
      toast.error(message);
    } finally {
      setLoadingPreview(false);
    }
  }

  function resetForm() {
    setFile(null);
    setPreview(null);
    setMapping(buildDefaultMapping([]));
    setPreviewError(null);
    setLoadingPreview(false);
    setUploading(false);
    setImportResult(null);
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file || !preview) {
      setPreviewError("Selecione um arquivo valido antes de importar.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setPreviewError("Sessao expirada. Faca login novamente.");
      return;
    }

    setUploading(true);
    setPreviewError(null);

    try {
      const result = await importAssets(file, mapping, token);
      setImportResult(result);
      onImported(result.imported);

      toast.success(
        `Importacao concluida: ${result.importedCount} importado(s), ${result.ignoredCount} ignorado(s).`,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Nao foi possivel importar os assets.";
      setPreviewError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
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
              <p className="eyebrow">Importacao em massa</p>
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
              <div className="grid gap-4 lg:grid-cols-[minmax(18rem,26rem)_1fr]">
                <div className="space-y-4">
                  <section className="surface-soft rounded-[24px] px-4 py-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold [color:var(--text-primary)]">
                          Modelo de importacao
                        </div>
                        <div className="mt-1 text-xs [color:var(--text-secondary)]">
                          Baixe um CSV com as colunas corretas.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={downloadCsvTemplate}
                        className="btn-secondary px-4 py-2.5 text-sm"
                      >
                        Baixar modelo CSV
                      </button>
                    </div>

                    <label className="block text-sm">
                      <span className="font-medium [color:var(--text-primary)]">
                        Arquivo CSV ou XLSX
                      </span>
                      <input
                        type="file"
                        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={handleFileChange}
                        className="brand-input mt-1.5"
                        disabled={uploading}
                      />
                    </label>

                    <p className="mt-2 text-xs [color:var(--text-secondary)]">
                      O arquivo precisa ter uma linha de cabecalho.
                    </p>
                    <p className="mt-2 text-xs [color:var(--text-secondary)]">
                      {file ? `Arquivo selecionado: ${file.name}` : "Nenhum arquivo selecionado."}
                    </p>
                  </section>

                  <section className="surface-soft rounded-[24px] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold [color:var(--text-primary)]">
                          Mapeamento de colunas
                        </div>
                        <div className="mt-1 text-xs [color:var(--text-secondary)]">
                          Ajuste os campos antes de importar.
                        </div>
                      </div>
                      {loadingPreview ? (
                        <span className="status-pill">Lendo...</span>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-3">
                      {FIELD_CONFIGS.map((field) => (
                        <label key={field.field} className="block text-sm">
                          <span className="font-medium [color:var(--text-primary)]">
                            {field.label} {field.required ? "*" : ""}
                          </span>
                          <select
                            value={mapping[field.field]}
                            onChange={(event) =>
                              setMapping((current) => ({
                                ...current,
                                [field.field]: event.target.value,
                              }))
                            }
                            className="brand-input mt-1.5"
                            disabled={!preview || uploading}
                          >
                            <option value="">
                              {field.required ? "Selecione uma coluna" : "Nao importar"}
                            </option>
                            {preview?.headers.map((header) => (
                              <option key={header} value={header}>
                                {header}
                              </option>
                            ))}
                          </select>
                          <div className="mt-1 text-xs [color:var(--text-secondary)]">
                            {field.help}
                          </div>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="surface-soft rounded-[24px] px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold [color:var(--text-primary)]">
                        Resumo do preview
                      </div>
                      <span className="status-pill">{validatedRows.length} linha(s)</span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm [color:var(--text-secondary)]">
                      <div>
                        <span className="font-semibold [color:var(--text-primary)]">
                          Validas:
                        </span>{" "}
                        {validCount}
                      </div>
                      <div>
                        <span className="font-semibold [color:var(--text-primary)]">
                          Com erro:
                        </span>{" "}
                        {invalidCount}
                      </div>
                    </div>

                    {previewError ? (
                      <div className="status-banner-error mt-3 rounded-[18px] px-4 py-3 text-sm">
                        {previewError}
                      </div>
                    ) : null}
                  </section>
                </div>

                <section className="surface-soft rounded-[24px] px-4 py-4">
                  <div className="flex flex-col gap-3 border-b pb-4 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold [color:var(--text-primary)]">
                        Preview das linhas
                      </div>
                      <div className="mt-1 text-xs [color:var(--text-secondary)]">
                        Linhas invalidas serao ignoradas na importacao.
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="status-pill">
                        {uploading ? "Importando..." : "Pronto para importar"}
                      </span>
                      <button
                        type="submit"
                        disabled={!canImport}
                        className="btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {uploading ? "Importando..." : "Importar ativos"}
                      </button>
                    </div>
                  </div>

                  {importResult ? (
                    <div className="mt-4 space-y-3">
                      <div className="status-banner-warning rounded-[18px] px-4 py-3 text-sm">
                        Importacao finalizada: {importResult.importedCount} importado(s),{" "}
                        {importResult.ignoredCount} ignorado(s).
                      </div>

                      {importResult.errors.length > 0 ? (
                        <div className="space-y-2">
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
                    </div>
                  ) : null}

                  <div className="mt-4 overflow-auto">
                    <table className="data-table data-table-compact">
                      <thead>
                        <tr>
                          <th>Linha</th>
                          <th>Codigo</th>
                          <th>Tipo</th>
                          <th>Marca</th>
                          <th>Modelo</th>
                          <th>Categoria</th>
                          <th>Localizacao</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validatedRows.slice(0, 50).map((row) => (
                          <tr key={row.rowNumber}>
                            <td className="cell-strong">{row.rowNumber}</td>
                            <td>{row.code || "-"}</td>
                            <td>{row.preview.type || "-"}</td>
                            <td>{row.preview.brand || "-"}</td>
                            <td>{row.preview.model || "-"}</td>
                            <td>{row.preview.categoryName || "-"}</td>
                            <td>{row.preview.locationName || "-"}</td>
                            <td>
                              {row.isValid ? (
                                <span className="status-pill">Valida</span>
                              ) : (
                                <span className="status-pill">Com erro</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 space-y-2">
                    {validatedRows
                      .filter((row) => !row.isValid)
                      .slice(0, 20)
                      .map((row) => (
                        <div
                          key={`error-${row.rowNumber}`}
                          className="status-banner-error rounded-[18px] px-4 py-3 text-sm"
                        >
                          Linha {row.rowNumber}
                          {row.code ? ` - ${row.code}` : ""}: {row.errors.join("; ")}
                        </div>
                      ))}
                  </div>
                </section>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t px-6 py-5 [border-color:var(--border-soft)] sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm [color:var(--text-secondary)]">
                {file ? "Revise o preview antes de importar." : "Selecione um arquivo para continuar."}
              </div>

              <div className="flex gap-2">
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



