"use client";

import { createLocation, getLocations } from "@/lib/api";
import type { Location } from "@/lib/types";
import ReferenceDataView from "./ReferenceDataView";

export default function LocationsView() {
  return (
    <ReferenceDataView<Location>
      current="locations"
      title="Localizacoes"
      subtitle="Cadastro e consulta dos locais usados para identificar onde cada asset esta alocado."
      countLabel="localizacao(s)"
      loadingText="Buscando localizacoes..."
      emptyText="Nenhuma localizacao cadastrada ainda. Use o botao Nova Localizacao para criar a primeira."
      buttonLabel="Nova Localizacao"
      modalTitle="Nova Localizacao"
      createLabel="Criar localizacao"
      successMessage="Localizacao criada com sucesso."
      namePlaceholder="Estoque TI, Escritorio, Financeiro..."
      descriptionPlaceholder="Descricao opcional do local."
      getItems={getLocations}
      createItem={createLocation}
    />
  );
}
