"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { NavKey } from "./AppNavigation";
import AppNavigation from "./AppNavigation";
import GlobalSearch from "./GlobalSearch";
import { useAuth } from "./AuthProvider";
import { roleLabel } from "@/lib/permissions";
import { useTheme } from "./ThemeProvider";

type ContentSize = "compact" | "standard" | "wide" | "full";

export default function AppShell({
  current,
  title,
  subtitle,
  actions,
  contentSize = "wide",
  children,
}: {
  current: NavKey;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  contentSize?: ContentSize;
  children: ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const { user, loadingAuth, error } = useAuth();

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow || "";
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024) {
        setMobileNavOpen(false);
      }
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <main className="app-shell">
      {loadingAuth ? (
        <section className="app-main">
          <div className="app-content app-content-wide">
            <header className="app-header">
              <div className="app-header-copy">
                <div className="h-4 w-32 rounded-full bg-[var(--surface-soft)]" />
                <div className="mt-4 h-8 w-64 rounded-full bg-[var(--surface-soft)]" />
                <div className="mt-4 h-4 w-full max-w-2xl rounded-full bg-[var(--surface-soft)]" />
              </div>
              <div className="app-header-actions">
                <div className="h-10 w-48 rounded-full bg-[var(--surface-soft)]" />
                <div className="h-10 w-56 rounded-full bg-[var(--surface-soft)]" />
              </div>
            </header>

            <div className="space-y-4">
              <div className="h-28 rounded-[30px] bg-[var(--surface-soft)]" />
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="h-28 rounded-[26px] bg-[var(--surface-soft)]" />
                <div className="h-28 rounded-[26px] bg-[var(--surface-soft)]" />
                <div className="h-28 rounded-[26px] bg-[var(--surface-soft)]" />
              </div>
              <div className="h-80 rounded-[30px] bg-[var(--surface-soft)]" />
            </div>
          </div>
        </section>
      ) : null}

      {loadingAuth ? null : (
        <>
      <button
        type="button"
        className="mobile-nav-toggle"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Abrir navegacao"
        aria-expanded={mobileNavOpen}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
        <span>Menu</span>
      </button>

      <button
        type="button"
        className={`app-sidebar-backdrop ${mobileNavOpen ? "app-sidebar-backdrop-open" : ""}`}
        onClick={() => setMobileNavOpen(false)}
        aria-label="Fechar navegacao"
      />

      <AppNavigation
        current={current}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onNavigate={() => setMobileNavOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
      />

      <section className="app-main">
        <div className={`app-content app-content-${contentSize}`}>
          <header className="app-header">
            <div className="app-header-copy">
              <p className="eyebrow">Inventario TI</p>
              <h1 className="page-title mt-3">{title}</h1>
              <p className="page-subtitle mt-3 max-w-3xl">{subtitle}</p>
            </div>

            <div className="app-header-actions">
              <div className="status-pill hidden max-w-[18rem] truncate sm:inline-flex">
                {loadingAuth
                  ? "Carregando perfil..."
                  : user
                    ? `${user.name} • ${roleLabel(user.role)}`
                    : error ?? "Perfil indisponível"}
              </div>
              <GlobalSearch />
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
          </header>

          <div className="app-page-body">{children}</div>
        </div>
      </section>
        </>
      )}
    </main>
  );
}
