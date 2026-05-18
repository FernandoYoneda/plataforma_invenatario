"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { createEmployee } from "@/lib/api";
import { getAuthToken } from "@/lib/auth";
import { canManageEmployees } from "@/lib/permissions";
import type { Employee } from "@/lib/types";
import { useAuth } from "./AuthProvider";

type ImportedRow = {
  rowNumber: number;
  values: Record<string, string>;
};

type ValidatedRow = ImportedRow & {
  name: string;
  email: string;
  department: string;
  position: string;
  errors: string[];
  isValid: boolean;
};

type PreviewState = {
  headers: string[];
  rows: ImportedRow[];
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

function normalizeText(value: unknown) {
  if (value === undefined || value === null) return "";

  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function escapeCsvCell(value: string) {
  const text = value ?? "";
  if (/[",\n\r;]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function downloadCsvTemplate() {
  const headers = [
    "nome",
    "email",
    "departamento",
    "cargo",
  ];

  const example = [
    "Ana Souza",
    "ana.souza@empresa.com",
    "TI",
    "Analista de Suporte",
  ];

  const csv = [
    headers.map(escapeCsvCell).join(","),
    example.map(escapeCsvCell).join(","),
  ].join("\r\n");

  const blob = new Blob(["\ufeff", csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "modelo-funcionarios.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
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

async function readCsv(file: File): Promise<PreviewState> {
  const workbook = XLSX.read(await file.text(), { type: "string" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Arquivo sem planilha válida.");
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
    throw new Error("Arquivo precisa conter cabeçalho e ao menos uma linha.");
  }

  return { headers, rows };
}

function valueByHeader(row: ImportedRow, header: string) {
  if (!header) return "";
  return row.values[header] ?? "";
}

function validateRows(preview: PreviewState, existingEmployees: Employee[]) {
  const headers = preview.headers;
  const nameHeader = findHeader(headers, ["nome", "funcionario", "funcionário"]);
  const emailHeader = findHeader(headers, ["email", "e-mail"]);
  const departmentHeader = findHeader(headers, ["departamento", "setor"]);
  const positionHeader = findHeader(headers, ["cargo", "posicao", "posição", "funcao", "função"]);

  const existingEmails = new Set(
    existingEmployees.map((employee) => normalizeText(employee.email)),
  );
  const seenEmails = new Set<string>();

  return preview.rows.map((row) => {
    const errors: string[] = [];
    const name = valueByHeader(row, nameHeader);
    const email = valueByHeader(row, emailHeader);
    const department = valueByHeader(row, departmentHeader);
    const position = valueByHeader(row, positionHeader);
    const normalizedEmail = normalizeText(email);

    if (!name.trim()) {
      errors.push("Nome é obrigatório.");
    }

    if (!email.trim()) {
      errors.push("Email é obrigatório.");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.push("Email inválido.");
    }

    if (normalizedEmail && existingEmails.has(normalizedEmail)) {
      errors.push("Já existe funcionário cadastrado com esse email.");
    }

    if (normalizedEmail) {
      if (seenEmails.has(normalizedEmail)) {
        errors.push("Email duplicado na planilha.");
      }
      seenEmails.add(normalizedEmail);
    }

    return {
      ...row,
      name,
      email,
      department,
      position,
      errors,
      isValid: errors.length === 0,
    };
  });
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
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

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
    return validateRows(preview, employees);
  }, [employees, preview]);

  const validCount = validatedRows.filter((row) => row.isValid).length;
  const invalidCount = validatedRows.length - validCount;
  const canImport = Boolean(file) && validCount > 0 && !uploading;

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setImportResult(null);

    if (!nextFile) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    setLoadingPreview(true);
    setPreviewError(null);

    try {
      const nextPreview = await readCsv(nextFile);
      setPreview(nextPreview);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Não foi possível ler o arquivo.";
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

    if (!file || !preview) {
      const message = "Selecione um arquivo CSV antes de importar.";
      setPreviewError(message);
      toast.error(message);
      return;
    }

    const rowsToImport = validatedRows.filter((row) => row.isValid);

    if (rowsToImport.length === 0) {
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

    const imported: Employee[] = [];
    const errors: ImportResult["errors"] = [];

    try {
      for (const row of rowsToImport) {
        try {
          const employee = await createEmployee(
            {
              name: row.name.trim(),
              email: row.email.trim(),
              department: row.department.trim() || null,
              position: row.position.trim() || null,
            },
            token,
          );
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

      const ignoredCount = validatedRows.length - imported.length;
      const result: ImportResult = {
        totalRows: validatedRows.length,
        importedCount: imported.length,
        ignoredCount,
        errors,
        imported,
      };

      setImportResult(result);
      if (imported.length > 0) {
        onImported(imported);
      }

      if (imported.length > 0) {
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
          className="glass-panel w-full max-w-6xl overflow-hidden rounded-[30px]"
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
              <div className="grid gap-4 lg:grid-cols-[minmax(18rem,26rem)_1fr]">
                <div className="space-y-4">
                  <section className="surface-soft rounded-[24px] px-4 py-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold [color:var(--text-primary)]">
                          Modelo de importação
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
                        Arquivo CSV
                      </span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleFileChange}
                        className="brand-input mt-1.5"
                        disabled={uploading}
                      />
                    </label>

                    <p className="mt-2 text-xs [color:var(--text-secondary)]">
                      O arquivo precisa ter uma linha de cabeçalho.
                    </p>
                    <p className="mt-2 text-xs [color:var(--text-secondary)]">
                      {file ? `Arquivo selecionado: ${file.name}` : "Nenhum arquivo selecionado."}
                    </p>
                  </section>

                  {importResult ? (
                    <section className="surface-soft rounded-[24px] px-4 py-4">
                      <div className="text-sm font-semibold [color:var(--text-primary)]">
                        Resumo da importação
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
                        <div className="rounded-[18px] border px-3 py-3 [border-color:var(--border-soft)]">
                          <div className="text-[var(--text-secondary)]">Importados</div>
                          <div className="mt-1 text-lg font-semibold [color:var(--text-primary)]">
                            {importResult.importedCount}
                          </div>
                        </div>
                        <div className="rounded-[18px] border px-3 py-3 [border-color:var(--border-soft)]">
                          <div className="text-[var(--text-secondary)]">Ignorados</div>
                          <div className="mt-1 text-lg font-semibold [color:var(--text-primary)]">
                            {importResult.ignoredCount}
                          </div>
                        </div>
                        <div className="rounded-[18px] border px-3 py-3 [border-color:var(--border-soft)]">
                          <div className="text-[var(--text-secondary)]">Erros</div>
                          <div className="mt-1 text-lg font-semibold [color:var(--text-primary)]">
                            {importResult.errors.length}
                          </div>
                        </div>
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
                        Pré-visualização
                      </div>
                      <div className="mt-1 text-xs [color:var(--text-secondary)]">
                        Valide os dados antes de importar.
                      </div>
                    </div>
                    {loadingPreview ? <span className="status-pill">Lendo...</span> : null}
                  </div>

                  {previewError ? (
                    <div className="status-banner-error mt-4 rounded-[22px] px-4 py-4 text-sm">
                      {previewError}
                    </div>
                  ) : null}

                  {preview ? (
                    <div className="mt-4 overflow-auto rounded-[20px] border [border-color:var(--border-soft)]">
                      <table className="data-table data-table-compact">
                        <thead>
                          <tr>
                            <th>Linha</th>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Departamento</th>
                            <th>Cargo</th>
                            <th>Validação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validatedRows.map((row) => (
                            <tr key={row.rowNumber}>
                              <td>{row.rowNumber}</td>
                              <td className="cell-strong">{row.name || "-"}</td>
                              <td>{row.email || "-"}</td>
                              <td>{row.department || "-"}</td>
                              <td>{row.position || "-"}</td>
                              <td>
                                {row.isValid ? (
                                  <span className="status-pill">OK</span>
                                ) : (
                                  <div className="space-y-1 text-xs text-rose-700">
                                    {row.errors.map((error) => (
                                      <div
                                        key={`${row.rowNumber}-${error}`}
                                        className="rounded-full bg-rose-100 px-2.5 py-1"
                                      >
                                        {error}
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
                      Selecione um arquivo CSV para visualizar os dados.
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="status-pill">
                        {validatedRows.length} linha(s)
                      </span>
                      <span className="status-pill">
                        {validCount} válida(s)
                      </span>
                      <span className="status-pill">
                        {invalidCount} com erro
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={!canImport}
                      className="btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {uploading ? "Importando..." : "Importar funcionários"}
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
