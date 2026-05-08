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
      className="glass-panel w-full max-w-md rounded-[32px] p-8"
    >
      <div className="mb-8">
        <p className="eyebrow">Inventario TI</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] [color:var(--text-primary)]">
          Entrar
        </h1>
        <p className="mt-2 text-sm [color:var(--text-secondary)]">
          Use suas credenciais para acessar os ativos.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium [color:var(--text-primary)]">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            className="brand-input text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium [color:var(--text-primary)]">
            Senha
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            className="brand-input text-sm"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary mt-6 w-full px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
