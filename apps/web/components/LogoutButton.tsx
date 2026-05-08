"use client";

import { useRouter } from "next/navigation";
import { clearAuthToken } from "@/lib/auth";

export default function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        clearAuthToken();
        router.replace("/login");
        router.refresh();
      }}
      className="rounded-2xl border border-[#d7d4cd] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition hover:bg-[#f9f5ef]"
    >
      Sair
    </button>
  );
}
