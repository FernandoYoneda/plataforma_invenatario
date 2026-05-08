"use client";

import Link from "next/link";
import LogoutButton from "./LogoutButton";

export default function AppNavigation({
  current,
}: {
  current: "dashboard" | "assets";
}) {
  const itemClass = (key: "dashboard" | "assets") =>
    key === current
      ? "rounded-2xl bg-[#8c5f46] px-4 py-2 text-sm font-semibold text-white"
      : "rounded-2xl border border-[#d7d4cd] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#f9f5ef]";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/dashboard" className={itemClass("dashboard")}>
        Dashboard
      </Link>
      <Link href="/assets" className={itemClass("assets")}>
        Assets
      </Link>
      <LogoutButton />
    </div>
  );
}
