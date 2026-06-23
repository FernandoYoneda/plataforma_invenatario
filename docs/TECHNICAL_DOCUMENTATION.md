# DOCUMENTAÇÃO TÉCNICA – SISTEMA DE INVENTÁRIO TI CASABELLA

## Visão Geral

Aplicação corporativa destinada ao controle de ativos de TI, funcionários, atribuições e auditoria.

---

# Arquitetura

Frontend (Next.js)

↓

Backend (NestJS)

↓

Prisma ORM

↓

PostgreSQL

---

# Stack Tecnológica

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS

## Backend

* NestJS
* TypeScript
* JWT Authentication

## Banco

* PostgreSQL

## ORM

* Prisma

## Infraestrutura

* Docker
* Docker Compose
* Cloudflare Tunnel

---

# Estrutura do Projeto

inventario-ti

├── apps

│ ├── api

│ └── web

├── prisma

├── scripts

├── docs

└── docker-compose.yml

---

# Autenticação

Fluxo:

Login

↓

JWT

↓

Armazenamento Local

↓

Requisições autenticadas

↓

/auth/me

↓

Perfil carregado

---

# Banco de Dados

Principais entidades:

* User
* Employee
* Asset
* Assignment
* Category
* Location
* AuditLog

---

# Variáveis de Ambiente

## Banco

DATABASE_URL

## JWT

JWT_SECRET

JWT_EXPIRES_IN

## Aplicação

API_PORT

WEB_PORT

## Admin

ADMIN_EMAIL

ADMIN_PASSWORD

ADMIN_NAME

---

# Docker

Subir ambiente

docker compose up -d

Rebuild completo

docker compose up -d --build

Parar ambiente

docker compose down

---

# Backup

Script oficial

scripts/backup-db.ps1

Objetivo

* Backup PostgreSQL
* Recuperação de desastres

---

# Restore

Script oficial

scripts/restore-db.ps1

Objetivo

* Restaurar backup completo

---

# Cloudflare Tunnel

Frontend

localhost:3000

Backend

localhost:3002

Objetivo

Permitir acesso externo sem abertura de portas no roteador.

---

# Processo de Atualização

1. git pull

2. docker compose down

3. docker compose up -d --build

4. validar aplicação

5. validar banco

---

# Boas Práticas

* Não executar prisma migrate reset em produção.
* Sempre realizar backup antes de migrations.
* Utilizar branches para novas funcionalidades.
* Validar build antes de realizar deploy.
* Registrar alterações relevantes em auditoria.

---

# Roadmap Futuro

* Controle avançado de smartphones
* Gestão patrimonial financeira
* Smart Pick
* Integração com ERP
* Assinatura digital de entrega
* Aplicativo mobile
