"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import BrandLogo from "./BrandLogo";
import LogoutButton from "./LogoutButton";

export type NavKey =
  | "dashboard"
  | "assets"
  | "employees"
  | "categories"
  | "locations"
  | "reports";

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M3 13.5h7.5V3H3v10.5Z" />
      <path d="M13.5 21H21v-7.5h-7.5V21Z" />
      <path d="M13.5 10.5H21V3h-7.5v7.5Z" />
      <path d="M3 21h7.5v-4.5H3V21Z" />
    </svg>
  );
}

function AssetsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="m3 7 9-4 9 4-9 4-9-4Z" />
      <path d="m3 7 9 4 9-4" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}

function EmployeesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <path d="M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M15 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CategoriesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M20 7.5V4a1 1 0 0 0-1-1h-5.5" />
      <path d="M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <path d="M3 8V6a2 2 0 0 1 2-2h4l2 2h9" />
    </svg>
  );
}

function LocationsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" />
      <path d="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 19h16" />
      <path d="M7 15V9" />
      <path d="M12 15V5" />
      <path d="M17 15v-3" />
    </svg>
  );
}

const mainItems: Array<{
  key: NavKey;
  href: string;
  label: string;
  icon: ReactNode;
}> = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { key: "assets", href: "/assets", label: "Assets", icon: <AssetsIcon /> },
  { key: "employees", href: "/employees", label: "Funcionarios", icon: <EmployeesIcon /> },
  { key: "categories", href: "/categories", label: "Categorias", icon: <CategoriesIcon /> },
  { key: "locations", href: "/locations", label: "Localizacoes", icon: <LocationsIcon /> },
  { key: "reports", href: "/reports", label: "Relatorios", icon: <ReportsIcon /> },
];

const futureItems: Array<{ label: string; icon: ReactNode }> = [];

export default function AppNavigation({ current }: { current: NavKey }) {
  const itemClass = (key: NavKey) =>
    key === current
      ? "app-nav-item app-nav-item-active"
      : "app-nav-item";

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-inner">
        <div className="app-brand">
          <BrandLogo
            variant="horizontal"
            tone="dark"
            className="app-brand-logo"
            imageClassName="app-brand-logo-image object-contain"
            priority
          />
          <p className="mt-4 max-w-[13.5rem] text-center text-sm leading-6 text-white/68">
            Plataforma corporativa de controle de ativos.
          </p>
        </div>

        <nav className="space-y-2">
          {mainItems.map((item) => (
            <Link key={item.key} href={item.href} className={itemClass(item.key)}>
              <span className="app-nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {futureItems.length > 0 ? (
          <div className="mt-8">
            <div className="px-3 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-white/36">
              Em breve
            </div>
            <div className="mt-3 space-y-2">
              {futureItems.map((item) => (
                <div key={item.label} className="app-nav-item app-nav-item-muted">
                  <span className="app-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-auto pt-6">
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
