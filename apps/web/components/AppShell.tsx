"use client";

import type { ReactNode } from "react";
import type { NavKey } from "./AppNavigation";
import AppNavigation from "./AppNavigation";

export default function AppShell({
  current,
  title,
  subtitle,
  actions,
  children,
}: {
  current: NavKey;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="app-shell">
      <AppNavigation current={current} />

      <section className="app-main">
        <div className="app-content">
          <header className="app-header">
            <div>
              <p className="eyebrow">Inventario TI</p>
              <h1 className="page-title mt-3">{title}</h1>
              <p className="page-subtitle mt-3 max-w-3xl">{subtitle}</p>
            </div>

            {actions ? <div className="app-header-actions">{actions}</div> : null}
          </header>

          <div className="space-y-6">{children}</div>
        </div>
      </section>
    </main>
  );
}
