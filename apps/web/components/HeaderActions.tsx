"use client";

import NewAssetModal from "./NewAssetModal";
import { useRouter } from "next/navigation";

export default function HeaderActions() {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {/* Novo ativo */}
      <NewAssetModal
        onCreated={() => {
          // força atualizar a lista após criar
          router.refresh();
        }}
      />
    </div>
  );
}
