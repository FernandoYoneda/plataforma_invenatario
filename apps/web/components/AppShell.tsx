"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { NavKey } from "./AppNavigation";
import AppNavigation from "./AppNavigation";

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
      />

      <section className="app-main">
        <div className={`app-content app-content-${contentSize}`}>
          <header className="app-header">
            <div className="app-header-copy">
              <p className="eyebrow">Inventario TI</p>
              <h1 className="page-title mt-3">{title}</h1>
              <p className="page-subtitle mt-3 max-w-3xl">{subtitle}</p>
            </div>

            {actions ? <div className="app-header-actions">{actions}</div> : null}
          </header>

          <div className="app-page-body">{children}</div>
        </div>
      </section>
    </main>
  );
}
