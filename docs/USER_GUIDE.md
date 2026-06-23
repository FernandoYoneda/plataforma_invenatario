# MANUAL DO USUÁRIO

# Sistema de Inventário TI Casabella

## Objetivo

O Sistema de Inventário TI foi desenvolvido para controlar os ativos corporativos da empresa, permitindo rastreamento, atribuição, devolução, auditoria e geração de relatórios.

---

# Acesso ao Sistema

## Login

Acesse a URL disponibilizada pela TI.

Informe:

* E-mail
* Senha

Clique em:

```txt
Entrar
```

---

# Dashboard

A tela inicial apresenta:

* Total de ativos
* Ativos em uso
* Ativos em estoque
* Funcionários ativos
* Atribuições ativas
* Gráficos gerenciais

---

# Ativos

Menu:

```txt
Ativos
```

Permite visualizar todos os equipamentos cadastrados.

---

## Cadastrar Ativo

Clique em:

```txt
Novo Ativo
```

Preencha:

* Tipo
* Categoria
* Marca
* Modelo
* Número de Série
* Valor
* Data de Compra
* Localização
* Observações

Clique em:

```txt
Salvar
```

---

## Tipos de Ativos

Exemplos:

* Notebook
* Desktop
* Smartphone
* Monitor
* Mouse
* Teclado
* Outros

---

## Smartphone

Quando o tipo for Smartphone, poderão existir campos adicionais:

* Número Principal
* Número Secundário
* IMEI 1
* IMEI 2
* Operadora

---

## Editar Ativo

Na lista de ativos:

```txt
Ações → Editar
```

Altere as informações desejadas.

Clique:

```txt
Salvar
```

---

## Excluir Ativo

Na lista:

```txt
Ações → Excluir
```

Observações:

* Ativos com atribuição ativa não podem ser excluídos.
* É necessário devolver o ativo antes da exclusão.

---

# QR Code

Cada ativo possui QR Code exclusivo.

Utilização:

* Identificação rápida
* Consulta de informações
* Inventário físico

---

# Funcionários

Menu:

```txt
Funcionários
```

---

## Cadastrar Funcionário

Clique:

```txt
Novo Funcionário
```

Informe:

* Nome
* E-mail
* Departamento
* Cargo
* Localização

Clique:

```txt
Salvar
```

---

## Inativar Funcionário

Na lista:

```txt
Ações → Inativar
```

O funcionário deixa de aparecer como ativo.

---

## Reativar Funcionário

Filtro:

```txt
Inativos
```

Clique:

```txt
Reativar
```

---

# Atribuição de Ativos

Permite registrar qual funcionário está utilizando determinado equipamento.

---

## Atribuir Ativo

Na tela de ativos:

```txt
Ações → Atribuir
```

Selecione:

* Funcionário
* Observação (opcional)

Clique:

```txt
Confirmar
```

---

## Efeitos da Atribuição

Automaticamente:

* Status muda para Em Uso
* Funcionário passa a ser responsável pelo ativo
* Localização pode ser atualizada conforme funcionário

---

## Devolver Ativo

Na tela de ativos:

```txt
Ações → Devolver
```

O sistema:

* encerra a atribuição
* devolve para estoque
* atualiza histórico

---

# Categorias

Menu:

```txt
Categorias
```

Permite:

* Criar
* Editar
* Excluir

Observação:

Categorias vinculadas a ativos não podem ser excluídas.

---

# Localizações

Menu:

```txt
Localizações
```

Permite:

* Criar
* Editar
* Excluir

Exemplos:

* Matriz
* Estoque
* Administrativo
* TI

---

# Importação de Dados

Permite importar:

* Ativos
* Funcionários

---

## Formato

Utilizar:

```txt
.xlsx
```

---

## Processo

1. Baixar modelo
2. Preencher planilha
3. Selecionar arquivo
4. Revisar dados
5. Corrigir erros diretamente na tela
6. Confirmar importação

---

## Importação de Ativos

Campos comuns:

* Tipo
* Categoria
* Marca
* Modelo
* Valor
* Data de Compra

O código patrimonial pode ser gerado automaticamente.

---

## Importação de Funcionários

Campos comuns:

* Nome
* E-mail
* Cargo
* Departamento
* Localização

---

# Relatórios

Menu:

```txt
Relatórios
```

---

## Relatórios Operacionais

Disponíveis:

* Ativos por categoria
* Ativos por localização
* Ativos atribuídos

---

## Relatórios Financeiros

Permitem consultar:

* Valor total dos ativos
* Valor por período
* Valor por categoria
* Valor por localização

Baseados na:

```txt
Data de Compra
```

---

# Auditoria

Menu:

```txt
Auditoria
```

Registra:

* Cadastros
* Edições
* Exclusões
* Importações
* Atribuições
* Devoluções
* Reativações

---

# Boas Práticas

* Sempre devolver ativos antes de excluir.
* Conferir dados antes da importação.
* Utilizar localizações corretas.
* Atualizar informações dos funcionários.
* Consultar auditoria em caso de dúvidas.

---

# Suporte

Em caso de dúvidas ou problemas:

Entrar em contato com a equipe de TI.

Fim do documento.
