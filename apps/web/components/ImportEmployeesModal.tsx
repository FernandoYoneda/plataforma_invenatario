"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  createEmployee,
  getEmployeesList,
  getLocations,
  inactivateEmployee,
} from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { canManageEmployees } from "@/lib/permissions";
import type { Employee, Location } from "@/lib/types";
import { useAuth } from "./AuthProvider";

type EmployeeImportField =
  | "name"
  | "email"
  | "department"
  | "position"
  | "status"
  | "location";

type EditableEmployeeRow = Record<EmployeeImportField, string> & {
  rowId: string;
  rowNumber: number;
};

type FieldError = {
  field: EmployeeImportField;
  message: string;
};

type ValidatedEmployeeRow = EditableEmployeeRow & {
  locationId: string;
  isActive: boolean;
  errors: FieldError[];
  isValid: boolean;
  isIgnored: boolean;
};

type PreviewState = {
  headers: string[];
  rows: Array<{
    rowNumber: number;
    values: Record<string, string>;
  }>;
};

type ImportResult = {
  totalRows: number;
  importedCount: number;
  ignoredCount: number;
  errors: Array<{
    rowNumber: number;
    message: string;
  }>;
  imported: Employee[];
};

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const FIELD_LABELS: Record<EmployeeImportField, string> = {
  name: "Nome",
  email: "Email",
  department: "Departamento",
  position: "Cargo",
  status: "Status",
  location: "Localização",
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

function valueByHeader(
  row: PreviewState["rows"][number],
  header: string,
) {
  if (!header) return "";
  return row.values[header] ?? "";
}

function formatWorksheet(sheet: XLSX.WorkSheet, rows: string[][]) {
  sheet["!cols"] = rows[0].map((_, columnIndex) => {
    const width = rows.reduce((max, row) => {
      const cellLength = String(row[columnIndex] ?? "").length;
      return Math.max(max, cellLength);
    }, 0);

    return { wch: Math.min(Math.max(width + 2, 12), 34) };
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
    ["nome", "email", "departamento", "cargo", "status", "localização"],
    [
      "Ana Souza",
      "ana.souza@empresa.com",
      "TI",
      "Analista de Suporte",
      "Ativo",
      "Matriz",
    ],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  formatWorksheet(sheet, rows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Funcionarios");

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
    cellStyles: true,
  });
  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "modelo-importacao-funcionarios.xlsx";
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

function previewToEditableRows(preview: PreviewState): EditableEmployeeRow[] {
  const nameHeader = findHeader(preview.headers, [
    "nome",
    "funcionario",
    "funcionário",
  ]);
  const emailHeader = findHeader(preview.headers, ["email", "e-mail"]);
  const departmentHeader = findHeader(preview.headers, ["departamento", "setor"]);
  const positionHeader = findHeader(preview.headers, [
    "cargo",
    "posicao",
    "posição",
    "funcao",
    "função",
  ]);
  const statusHeader = findHeader(preview.headers, ["status", "situacao", "situação"]);
  const locationHeader = findHeader(preview.headers, [
    "localizacao",
    "localização",
    "local",
    "unidade",
  ]);

  return preview.rows.map((row) => ({
    rowId: `row-${row.rowNumber}`,
    rowNumber: row.rowNumber,
    name: valueByHeader(row, nameHeader),
    email: valueByHeader(row, emailHeader),
    department: valueByHeader(row, departmentHeader),
    position: valueByHeader(row, positionHeader),
    status: valueByHeader(row, statusHeader) || "Ativo",
    location: valueByHeader(row, locationHeader),
  }));
}

function isBlankRow(row: EditableEmployeeRow) {
  return (Object.keys(FIELD_LABELS) as EmployeeImportField[]).every(
    (field) => !row[field].trim(),
  );
}

function parseStatus(value: string) {
  const normalized = normalizeText(value);

  if (!normalized || ["ativo", "active", "sim", "true", "1"].includes(normalized)) {
    return true;
  }

  if (["inativo", "inactive", "nao", "não", "false", "0"].includes(normalized)) {
    return false;
  }

  return null;
}

function validateRows(
  rows: EditableEmployeeRow[],
  existingEmployees: Employee[],
  locations: Location[],
) {
  const existingEmails = new Set(
    existingEmployees.map((employee) => normalizeText(employee.email)),
  );
  const seenEmails = new Set<string>();

  return rows.map((row) => {
    const errors: FieldError[] = [];
    const normalizedEmail = normalizeText(row.email);
    const status = parseStatus(row.status);
    const locationId =
      locations.find(
        (location) => normalizeText(location.name) === normalizeText(row.location),
      )?.id ?? "";
    const ignored = isBlankRow(row);

    if (ignored) {
      return {
        ...row,
        locationId: "",
        isActive: true,
        errors,
        isValid: false,
        isIgnored: true,
      };
    }

    if (!row.name.trim()) {
      errors.push({ field: "name", message: "Nome é obrigatório." });
    }

    if (!row.email.trim()) {
      errors.push({ field: "email", message: "Email é obrigatório." });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) {
      errors.push({ field: "email", message: "Email inválido." });
    }

    if (normalizedEmail && existingEmails.has(normalizedEmail)) {
      errors.push({
        field: "email",
        message: "Já existe funcionário cadastrado com esse email.",
      });
    }

    if (normalizedEmail) {
      if (seenEmails.has(normalizedEmail)) {
        errors.push({ field: "email", message: "Email duplicado na planilha." });
      }
      seenEmails.add(normalizedEmail);
    }

    if (status === null) {
      errors.push({ field: "status", message: "Status deve ser Ativo ou Inativo." });
    }

    if (!row.location.trim()) {
      errors.push({ field: "location", message: "Localização é obrigatória." });
    } else if (!locationId) {
      errors.push({
        field: "location",
        message: "Localização não encontrada na base.",
      });
    }

    return {
      ...row,
      locationId,
      isActive: status ?? true,
      errors,
      isValid: errors.length === 0,
      isIgnored: false,
    };
  });
}

function fieldHasError(row: ValidatedEmployeeRow, field: EmployeeImportField) {
  return row.errors.some((error) => error.field === field);
}

function fieldInputClass(row: ValidatedEmployeeRow, field: EmployeeImportField) {
  return `brand-input min-w-40 text-sm ${
    fieldHasError(row, field) ? "border-rose-400 bg-rose-50/70" : ""
  }`;
}

export default function ImportEmployeesModal({
  employees,
  onImported,
}: {
  employees: Employee[];
  onImported: (items: Employee[]) => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [editableRows, setEditableRows] = useState<EditableEmployeeRow[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [referencesError, setReferencesError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [knownEmployees, setKnownEmployees] = useState<Employee[]>(employees);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [open]);

  useEffect(() => {
    setKnownEmployees(employees);
  }, [employees]);

  useEffect(() => {
    if (!open) return;

    let active = true;

    async function loadReferences() {
      const token = getAuthToken();

      if (!token) {
        if (!active) return;
        setReferencesError("Sessão expirada. Faça login novamente.");
        setLocations([]);
        return;
      }

      setLoadingReferences(true);
      setReferencesError(null);

      try {
        const [locationsData, employeesData] = await Promise.all([
          getLocations(token),
          getEmployeesList(token, "all"),
        ]);
        if (!active) return;
        setLocations(locationsData);
        setKnownEmployees(employeesData);
      } catch (err: unknown) {
        if (!active) return;
        const message =
          err instanceof Error
            ? err.message
            : "Não foi possível carregar localizações e funcionários.";
        setReferencesError(message);
      } finally {
        if (active) setLoadingReferences(false);
      }
    }

    loadReferences();

    return () => {
      active = false;
    };
  }, [open]);

  const validatedRows = useMemo(
    () => validateRows(editableRows, knownEmployees, locations),
    [editableRows, knownEmployees, locations],
  );

  const ignoredCount = validatedRows.filter((row) => row.isIgnored).length;
  const rowsWithData = validatedRows.filter((row) => !row.isIgnored);
  const validRows = rowsWithData.filter((row) => row.isValid);
  const validCount = validRows.length;
  const invalidCount = rowsWithData.length - validCount;
  const canImport =
    Boolean(file) &&
    validCount > 0 &&
    invalidCount === 0 &&
    !uploading &&
    !loadingReferences;

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

  function updateRow(
    rowId: string,
    field: EmployeeImportField,
    value: string,
  ) {
    setImportResult(null);
    setEditableRows((current) =>
      current.map((row) =>
        row.rowId === rowId ? { ...row, [field]: value } : row,
      ),
    );
  }

  function resetForm() {
    setFile(null);
    setEditableRows([]);
    setPreviewError(null);
    setImportResult(null);
  }

  function close() {
    if (!uploading) {
      setOpen(false);
      resetForm();
    }
  }

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportResult(null);

    if (!file || editableRows.length === 0) {
      const message = "Selecione uma planilha antes de importar.";
      setPreviewError(message);
      toast.error(message);
      return;
    }

    if (invalidCount > 0) {
      const message = "Corrija os erros da pré-visualização antes de importar.";
      setPreviewError(message);
      toast.error(message);
      return;
    }

    if (validRows.length === 0) {
      const message = "Nenhuma linha válida encontrada para importação.";
      setPreviewError(message);
      toast.error(message);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      const message = "Sessão expirada. Faça login novamente.";
      setPreviewError(message);
      toast.error(message);
      return;
    }

    setUploading(true);
    setPreviewError(null);

    const imported: Employee[] = [];
    const errors: ImportResult["errors"] = [];

    try {
      for (const row of validRows) {
        try {
          const created = await createEmployee(
            {
              name: row.name.trim(),
              email: row.email.trim(),
              department: row.department.trim() || null,
              position: row.position.trim() || null,
              locationId: row.locationId,
            },
            token,
          );

          const employee = row.isActive
            ? created
            : await inactivateEmployee(created.id, token);

          imported.push(employee);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Não foi possível importar a linha.";
          errors.push({
            rowNumber: row.rowNumber,
            message,
          });
        }
      }

      const result: ImportResult = {
        totalRows: editableRows.length,
        importedCount: imported.length,
        ignoredCount: ignoredCount + errors.length,
        errors,
        imported,
      };

      setImportResult(result);
      if (imported.length > 0) {
        onImported(imported);
        setKnownEmployees((current) => [...current, ...imported]);
        toast.success(
          `Importação concluída: ${result.importedCount} importado(s), ${result.ignoredCount} ignorado(s).`,
        );
      } else {
        toast.error("Nenhum funcionário foi importado.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Não foi possível importar os funcionários.";
      setPreviewError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  if (!canManageEmployees(user?.role)) {
    return null;
  }

  const modal = (
    <div className="fixed inset-0 z-[99999]" onClick={close}>
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
                Importar funcionários
              </h2>
            </div>

            <button
              type="button"
              onClick={close}
              disabled={uploading}
              className="btn-secondary px-3 py-2 text-sm disabled:opacity-50"
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
                      Os dados serão exibidos para revisão antes da importação.
                    </p>
                    <p className="mt-2 text-xs [color:var(--text-secondary)]">
                      Localização é obrigatória e deve existir no cadastro.
                    </p>
                    <p className="mt-2 text-xs [color:var(--text-secondary)]">
                      {file ? `Arquivo selecionado: ${file.name}` : "Nenhum arquivo selecionado."}
                    </p>
                    {loadingReferences ? (
                      <div className="status-pill mt-3">Carregando referências...</div>
                    ) : null}
                    {referencesError ? (
                      <div className="status-banner-warning mt-3 rounded-[18px] px-3 py-2 text-xs">
                        {referencesError}
                      </div>
                    ) : null}
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
                  </section>

                  {importResult ? (
                    <section className="surface-soft rounded-[24px] px-4 py-4">
                      <div className="text-sm font-semibold [color:var(--text-primary)]">
                        Resultado
                      </div>
                      <div className="mt-3 text-sm [color:var(--text-secondary)]">
                        {importResult.importedCount} importado(s),{" "}
                        {importResult.ignoredCount} ignorado(s).
                      </div>

                      {importResult.errors.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          {importResult.errors.map((error) => (
                            <div
                              key={`${error.rowNumber}-${error.message}`}
                              className="status-banner-error rounded-[18px] px-3 py-2 text-xs"
                            >
                              Linha {error.rowNumber}: {error.message}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </div>

                <section className="surface-soft rounded-[24px] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold [color:var(--text-primary)]">
                        Pré-visualização editável
                      </div>
                      <div className="mt-1 text-xs [color:var(--text-secondary)]">
                        Corrija os campos diretamente na tabela.
                      </div>
                    </div>
                    {loadingPreview ? <span className="status-pill">Lendo...</span> : null}
                  </div>

                  {previewError ? (
                    <div className="status-banner-error mt-4 rounded-[22px] px-4 py-4 text-sm">
                      {previewError}
                    </div>
                  ) : null}

                  {editableRows.length > 0 ? (
                    <div className="mt-4 overflow-auto rounded-[20px] border [border-color:var(--border-soft)]">
                      <table className="data-table data-table-compact">
                        <thead>
                          <tr>
                            <th>Linha</th>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Departamento</th>
                            <th>Cargo</th>
                            <th>Status</th>
                            <th>Localização</th>
                            <th>Validação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validatedRows.map((row) => (
                            <tr key={row.rowId}>
                              <td>{row.rowNumber}</td>
                              <td>
                                <input
                                  value={row.name}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "name", event.target.value)
                                  }
                                  className={fieldInputClass(row, "name")}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.email}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "email", event.target.value)
                                  }
                                  className={fieldInputClass(row, "email")}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.department}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "department", event.target.value)
                                  }
                                  className={fieldInputClass(row, "department")}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.position}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "position", event.target.value)
                                  }
                                  className={fieldInputClass(row, "position")}
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
                                  <option value="Ativo">Ativo</option>
                                  <option value="Inativo">Inativo</option>
                                </select>
                              </td>
                              <td>
                                <select
                                  value={row.location}
                                  onChange={(event) =>
                                    updateRow(row.rowId, "location", event.target.value)
                                  }
                                  className={fieldInputClass(row, "location")}
                                >
                                  <option value="">Selecione</option>
                                  {locations.map((location) => (
                                    <option key={location.id} value={location.name}>
                                      {location.name}
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

                  <div className="mt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={!canImport}
                      className="btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {uploading ? "Importando..." : "Confirmar importação"}
                    </button>
                  </div>
                </section>
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
          setPreviewError(null);
          setImportResult(null);
          setOpen(true);
        }}
        className="btn-secondary px-4 py-2.5 text-sm"
      >
        Importar funcionários
      </button>

      {open && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
