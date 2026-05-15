import BrandLogo from "@/components/BrandLogo";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="login-page-shell">
      <div className="login-page-layout">
        <section className="login-hero-panel">
          <div className="login-hero-brand">
            <BrandLogo
              variant="horizontal"
              tone="dark"
              className="login-hero-logo"
              imageClassName="login-hero-logo-image object-contain"
              priority
            />
          </div>

          <div className="login-hero-copy">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f5cdc4]">
              Plataforma interna
            </p>
            <h2 className="login-hero-title">
              Controle o ciclo de vida dos ativos com uma interface mais clara.
            </h2>
            <p className="login-hero-text">
              Login, dashboard, inventario, atribuicoes e funcionarios em um
              fluxo unico, com identidade visual alinhada a Casabella.
            </p>
          </div>

          <div className="login-feature-grid">
            {[
              { label: "Inventario", value: "Assets e status" },
              { label: "Atribuicoes", value: "Controle ativo" },
              { label: "Equipe", value: "Funcionarios" },
            ].map((item) => (
              <div
                key={item.label}
                className="login-feature-card"
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

        <div className="login-form-column">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
