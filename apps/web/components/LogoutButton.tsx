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
      className="btn-secondary w-full px-4 py-3 text-sm"
    >
      Sair
    </button>
  );
}
