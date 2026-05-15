"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clearAuthToken, getAuthToken } from "@/lib/auth";
import { inactivateEmployee } from "@/lib/api";
import type { Employee } from "@/lib/types";

export default function DeleteEmployeeButton({
  employee,
  onDeleted,
}: {
  employee: Employee;
  onDeleted: (employeeId: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  function close() {
    if (!loading) {
      setOpen(false);
    }
  }

  function handleAuthError(err: unknown) {
    if (
      err instanceof Error &&
      "status" in err &&
      typeof err.status === "number" &&
      err.status === 401
    ) {
      clearAuthToken();
      router.replace("/login");
      return true;
    }

    return false;
  }

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, open]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [open]);

  async function handleDelete() {
    const token = getAuthToken();

    if (!token) {
      clearAuthToken();
      router.replace("/login");
      return;
    }

    setLoading(true);

    try {
      await inactivateEmployee(employee.id, token);
      toast.success("Funcionário inativado com sucesso.");
      onDeleted(employee.id);
      setOpen(false);
    } catch (err: unknown) {
      if (handleAuthError(err)) {
        return;
      }

      const rawMessage =
        err instanceof Error ? err.message : "Não foi possível inativar o funcionário.";

      const message = rawMessage.toLowerCase().includes("ativos atribu")
        ? "Funcionário possui ativos atribuídos. Devolva os ativos antes de inativar."
        : rawMessage;

      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="action-button border-rose-200 bg-rose-50/90 text-rose-700 hover:bg-rose-100"
      >
        Inativar
      </button>

      {open && (
        <div className="fixed inset-0 z-[99999]" onClick={close}>
          <div className="absolute inset-0 bg-[rgba(23,58,67,0.66)] backdrop-blur-[3px]" />

          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="glass-panel w-full max-w-md overflow-hidden rounded-[30px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b px-6 py-5 [border-color:var(--border-soft)]">
                <p className="eyebrow">Confirmacao</p>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] [color:var(--text-primary)]">
                  Inativar funcionário
                </h2>
              </div>

              <div className="px-6 py-5 text-sm [color:var(--text-secondary)]">
                <p>
                  Voce tem certeza que deseja inativar{" "}
                  <span className="font-medium [color:var(--text-primary)]">
                    {employee.name}
                  </span>
                  ?
                </p>
                <p className="mt-3">
                  O historico e a auditoria permanecem intactos.
                </p>
              </div>

              <div className="flex justify-end gap-3 border-t px-6 py-5 [border-color:var(--border-soft)]">
                <button
                  type="button"
                  onClick={close}
                  disabled={loading}
                  className="btn-secondary px-4 py-3 text-sm disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="btn-danger px-5 py-3 text-sm disabled:opacity-60"
                >
                  {loading ? "Inativando..." : "Inativar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
