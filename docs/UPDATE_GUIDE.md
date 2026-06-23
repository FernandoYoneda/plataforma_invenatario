# GUIA DE ATUALIZAÇÃO E MANUTENÇÃO

# Sistema de Inventário TI Casabella

## Objetivo

Este documento descreve os procedimentos oficiais para atualização, manutenção, backup, restauração e recuperação do ambiente do Sistema de Inventário TI.

---

# Informações do Ambiente

## Estrutura

Frontend:

* Next.js
* Porta 3000

Backend:

* NestJS
* Porta 3002

Banco:

* PostgreSQL
* Docker

Infraestrutura:

* Docker Compose
* Cloudflare Tunnel

---

# Antes de Atualizar

Sempre realizar os seguintes passos:

## 1. Verificar containers

```powershell
docker ps
```

## 2. Verificar espaço em disco

```powershell
Get-PSDrive
```

## 3. Criar backup do banco

```powershell
.\scripts\backup-db.ps1
```

Confirmar geração do arquivo de backup antes de continuar.

---

# Atualização Padrão

## Passo 1

Entrar na pasta do projeto

```powershell
cd C:\Users\ADMINISTRATOR\Desktop\inventario-ti
```

## Passo 2

Atualizar código

```powershell
git pull
```

## Passo 3

Reconstruir ambiente

```powershell
docker compose up -d --build
```

## Passo 4

Verificar status

```powershell
docker ps
```

Containers esperados:

* api
* web
* db
* pgadmin

Todos devem estar com status:

```txt
Up
```

---

# Atualização com Alteração de Banco

Quando houver migrations Prisma.

## Executar deploy das migrations

```powershell
docker compose exec api npx prisma migrate deploy
```

## Conferir status

```powershell
docker compose exec api npx prisma migrate status
```

Resultado esperado:

```txt
Database schema is up to date
```

---

# Atualização Completa

Caso existam problemas após atualização.

## Parar ambiente

```powershell
docker compose down
```

## Reconstruir tudo

```powershell
docker compose up -d --build
```

## Conferir logs

Backend:

```powershell
docker compose logs -f api
```

Frontend:

```powershell
docker compose logs -f web
```

Banco:

```powershell
docker compose logs -f db
```

---

# Backup

## Backup manual

```powershell
.\scripts\backup-db.ps1
```

## Local dos backups

```txt
/backups
```

## Recomendação

Realizar backup:

* antes de atualizações
* antes de migrations
* antes de importações em massa

---

# Restore

## Restaurar banco

```powershell
.\scripts\restore-db.ps1
```

Selecionar o arquivo desejado.

## Após restore

Reiniciar containers:

```powershell
docker compose restart
```

---

# Cloudflare Tunnel

## Frontend

```powershell
cd C:\Users\ADMINISTRATOR\Desktop\cloudflared

.\cloudflared.exe tunnel --protocol http2 --url http://localhost:3000
```

## Backend

Novo PowerShell:

```powershell
cd C:\Users\ADMINISTRATOR\Desktop\cloudflared

.\cloudflared.exe tunnel --protocol http2 --url http://localhost:3002
```

---

# Problemas Comuns

## Sistema não abre

Verificar:

```powershell
docker ps
```

Se containers estiverem parados:

```powershell
docker compose up -d
```

---

## Login não funciona

Verificar API:

```powershell
docker compose logs -f api
```

Verificar usuário administrador.

---

## Cloudflare caiu

Fechar túnel antigo.

Executar novamente:

Frontend:

```powershell
.\cloudflared.exe tunnel --protocol http2 --url http://localhost:3000
```

Backend:

```powershell
.\cloudflared.exe tunnel --protocol http2 --url http://localhost:3002
```

Atualizar URLs do ambiente se necessário.

---

## Banco não conecta

Verificar:

```powershell
docker compose logs -f db
```

Verificar variável:

```txt
DATABASE_URL
```

---

## Aplicação ficou lenta

Executar:

```powershell
docker stats
```

Verificar:

* CPU
* Memória
* Disco

---

# Procedimento de Emergência

Caso o sistema pare completamente.

## Passo 1

Parar ambiente:

```powershell
docker compose down
```

## Passo 2

Confirmar integridade do backup.

## Passo 3

Restaurar último backup válido.

## Passo 4

Subir novamente:

```powershell
docker compose up -d --build
```

## Passo 5

Validar:

* Login
* Dashboard
* Ativos
* Funcionários
* Relatórios
* Auditoria

---

# Checklist de Deploy

Antes de finalizar uma atualização:

* Build da API executado
* Build do Frontend executado
* Backup realizado
* Migrations aplicadas
* Containers funcionando
* Login validado
* Cadastro de ativo validado
* Cadastro de funcionário validado
* Relatórios validados
* Auditoria validada
* Cloudflare operacional

---

# Histórico de Versões

Manter registro das versões implantadas.

Exemplo:

| Data       | Versão | Alteração                                 |
| ---------- | ------ | ----------------------------------------- |
| 12/05/2026 | v1.1.0 | Dashboard, ativos, auditoria              |
| 28/05/2026 | v1.2.0 | XLSX, smartphones, relatórios financeiros |

Fim do documento.
