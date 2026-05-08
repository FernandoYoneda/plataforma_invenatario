import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#f4e8dd,transparent_36%),linear-gradient(180deg,#f8f4ee_0%,#efe7dc_100%)] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <section className="rounded-[36px] border border-black/10 bg-[#1f2937] px-8 py-10 text-white shadow-[0_30px_100px_rgba(15,23,42,0.22)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d6b79d]">
            Casabella
          </p>
          <h2 className="mt-4 max-w-xl text-4xl font-semibold tracking-[-0.04em]">
            Controle seus ativos de TI em um fluxo simples.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/72">
            Esta tela autentica no endpoint POST /auth/login, armazena o token
            no navegador e libera a consulta da listagem em GET /assets.
          </p>
        </section>

        <div className="flex items-center justify-center">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
