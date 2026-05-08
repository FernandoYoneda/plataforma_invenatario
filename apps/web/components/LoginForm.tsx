"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { login } from "@/lib/api";
import { setAuthToken } from "@/lib/auth";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email.trim() || !password) {
      toast.error("Preencha email e senha.");
      return;
    }

    setLoading(true);

    try {
      const response = await login({
        email: email.trim(),
        password,
      });

      setAuthToken(response.accessToken);
      toast.success("Login realizado com sucesso.");
      router.replace("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Nao foi possivel fazer login.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md rounded-[28px] border border-black/10 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)]"
    >
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8c5f46]">
          Inventario TI
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#1f2937]">
          Entrar
        </h1>
        <p className="mt-2 text-sm text-[#6b7280]">
          Use suas credenciais para acessar os ativos.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#374151]">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            className="w-full rounded-2xl border border-[#d7d4cd] bg-[#fcfaf7] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#8c5f46] focus:bg-white"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-[#374151]">
            Senha
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-2xl border border-[#d7d4cd] bg-[#fcfaf7] px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#8c5f46] focus:bg-white"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-2xl bg-[#8c5f46] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
