"use client";

import { createCategory, deleteCategory, getCategories } from "@/lib/api";
import type { Category } from "@/lib/types";
import ReferenceDataView from "./ReferenceDataView";

export default function CategoriesView() {
  return (
    <ReferenceDataView<Category>
      current="categories"
      title="Categorias"
      subtitle="Cadastro e consulta das categorias usadas para organizar os assets do inventario."
      countLabel="categoria(s)"
      loadingText="Buscando categorias..."
      emptyText="Nenhuma categoria cadastrada ainda. Use o botao Nova Categoria para criar a primeira."
      buttonLabel="Nova Categoria"
      modalTitle="Nova Categoria"
      createLabel="Criar categoria"
      successMessage="Categoria criada com sucesso."
      namePlaceholder="Notebooks, Perifericos, Monitores..."
      descriptionPlaceholder="Descricao opcional da categoria."
      getItems={getCategories}
      createItem={createCategory}
      deleteItem={deleteCategory}
    />
  );
}
