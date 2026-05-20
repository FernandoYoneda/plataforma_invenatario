"use client";

import { createLocation, deleteLocation, getLocations } from "@/lib/api";
import type { Location } from "@/lib/types";
import ReferenceDataView from "./ReferenceDataView";

export default function LocationsView() {
  return (
    <ReferenceDataView<Location>
      current="locations"
      title="Localizações"
      subtitle="Cadastro e consulta dos locais usados para identificar onde cada asset esta alocado."
      countLabel="localização(ões)"
      loadingText="Buscando localizações..."
      emptyText="Nenhuma localização cadastrada ainda. Use o botao Nova Localização para criar a primeira."
      buttonLabel="Nova Localização"
      modalTitle="Nova Localização"
      createLabel="Criar localização"
      successMessage="Localização criada com sucesso."
      namePlaceholder="Estoque TI, Escritorio, Financeiro..."
      descriptionPlaceholder="Descricao opcional do local."
      getItems={getLocations}
      createItem={createLocation}
      deleteItem={deleteLocation}
    />
  );
}
