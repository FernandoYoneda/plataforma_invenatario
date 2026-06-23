# MODELO SEMÂNTICO – SISTEMA DE INVENTÁRIO TI CASABELLA

## Objetivo

O Sistema de Inventário TI tem como objetivo controlar o ciclo de vida dos ativos corporativos, permitindo cadastro, rastreabilidade, atribuição, devolução, auditoria e relatórios gerenciais.

---

# Entidades Principais

## Ativo

Representa qualquer equipamento ou recurso físico controlado pela área de TI.

### Exemplos

* Notebook
* Desktop
* Monitor
* Mouse
* Teclado
* Smartphone
* Outros dispositivos

### Atributos Principais

| Campo         | Descrição           |
| ------------- | ------------------- |
| id            | Identificador único |
| assetCode     | Código patrimonial  |
| type          | Tipo do ativo       |
| category      | Categoria           |
| brand         | Marca               |
| model         | Modelo              |
| serialNumber  | Número de série     |
| purchaseValue | Valor de aquisição  |
| purchaseDate  | Data de aquisição   |
| location      | Localização atual   |
| status        | Situação atual      |
| notes         | Observações         |

---

## Funcionário

Representa um colaborador apto a receber ativos.

### Atributos Principais

| Campo      | Descrição           |
| ---------- | ------------------- |
| id         | Identificador único |
| name       | Nome                |
| email      | E-mail              |
| department | Departamento        |
| role       | Cargo               |
| location   | Unidade             |
| isActive   | Status do cadastro  |

---

## Categoria

Classificação dos ativos.

### Exemplos

* Notebook
* Desktop
* Smartphone
* Monitor
* Periféricos

---

## Localização

Representa unidades físicas ou setores.

### Exemplos

* Matriz
* Administrativo
* TI
* Estoque
* Filial

---

## Atribuição (Assignment)

Representa a posse temporária ou permanente de um ativo por um funcionário.

### Regras

* Um ativo pode possuir apenas uma atribuição ativa.
* Um funcionário pode possuir várias atribuições.
* A devolução encerra a atribuição.

### Dados registrados

| Campo      | Descrição             |
| ---------- | --------------------- |
| Asset      | Ativo vinculado       |
| Employee   | Funcionário vinculado |
| AssignedAt | Data da entrega       |
| ReturnedAt | Data da devolução     |

---

## Auditoria

Registro de eventos executados no sistema.

### Eventos

* Login
* Cadastro
* Edição
* Exclusão
* Importação
* Exportação
* Atribuição
* Devolução
* Reativação

### Objetivo

Garantir rastreabilidade completa das operações.

---

# Fluxos de Negócio

## Entrada de Ativo

Cadastro → Estoque → Disponível

## Entrega de Ativo

Estoque → Atribuição → Em Uso

## Devolução

Em Uso → Estoque

## Baixa

Em Uso ou Estoque → Baixado

## Auditoria

Toda ação relevante gera registro histórico.

---

# Relatórios

## Operacionais

* Ativos por categoria
* Ativos por localização
* Ativos atribuídos

## Financeiros

* Valor total investido
* Valor por período
* Valor por categoria
* Valor por localização

Baseados em:

* purchaseDate
* purchaseValue
