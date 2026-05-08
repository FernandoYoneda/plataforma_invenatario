import BrandLogo from "@/components/BrandLogo";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="page-shell">
      <div className="page-width grid min-h-[calc(100vh-4rem)] gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
        <section className="overflow-hidden rounded-[38px] border [border-color:rgba(247,243,237,0.12)] bg-[linear-gradient(160deg,rgba(23,58,67,0.98)_0%,rgba(31,75,85,0.96)_62%,rgba(215,121,103,0.84)_150%)] px-7 py-9 text-white shadow-[0_34px_100px_rgba(23,58,67,0.26)] sm:px-10 sm:py-12">
          <div className="login-hero-brand">
            <BrandLogo
              variant="horizontal"
              tone="dark"
              className="login-hero-logo"
              imageClassName="login-hero-logo-image object-contain"
              priority
            />
          </div>

          <div className="mt-8 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f5cdc4]">
              Plataforma interna
            </p>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white lg:text-[3.35rem]">
              Controle o ciclo de vida dos ativos com uma interface mais clara.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-white/78">
              Login, dashboard, inventario, atribuicoes e funcionarios em um
              fluxo unico, com identidade visual alinhada a Casabella.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { label: "Inventario", value: "Assets e status" },
              { label: "Atribuicoes", value: "Controle ativo" },
              { label: "Equipe", value: "Funcionarios" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] border border-white/12 bg-white/8 px-5 py-4 backdrop-blur"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f5cdc4]">
                  {item.label}
                </div>
                <div className="mt-2 text-sm font-medium text-white/88">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex items-center justify-center">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
