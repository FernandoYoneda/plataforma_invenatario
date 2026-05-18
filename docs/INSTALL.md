# Instalação e operação

Este guia cobre a instalação local/interna do Inventário TI Casabella com Docker, PostgreSQL, pgAdmin, migrations, seed, backup e restore.

## Requisitos do sistema

- Windows 10/11 com PowerShell
- Docker Desktop atualizado
- Node.js 20+ para desenvolvimento local
- Git
- Porta livre para:
  - API: `3000`
  - Web: `3001`
  - pgAdmin: `5050`
  - PostgreSQL no host: `5434`

## Estrutura

- `apps/api`: backend NestJS + Prisma
- `apps/web`: frontend Next.js
- `docker-compose.yml`: PostgreSQL, pgAdmin, API e Web
- `scripts/`: backup, restore e validações operacionais

## Configuração dos arquivos `.env`

Crie os arquivos a partir dos exemplos:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Troque os valores padrão antes de subir o ambiente:

- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `PGADMIN_DEFAULT_PASSWORD`
- `ADMIN_PASSWORD`
- `ADMIN_EMAIL`
- `ADMIN_NAME`

Revise também:

- `DATABASE_URL` da raiz apontando para `db:5432`
- `CORS_ORIGIN`
- `NEXT_PUBLIC_API_URL`

## Subir com Docker

```powershell
docker compose up -d db pgadmin
docker compose run --rm api npx prisma migrate deploy
docker compose run --rm api npx prisma db seed
docker compose up -d api web
```

Se estiver em ambiente mais antigo, use `docker-compose` no lugar de `docker compose`.

## Login inicial

O seed cria o administrador inicial conforme as variáveis de ambiente da API.

Após o primeiro acesso:

1. Entre com o usuário admin inicial.
2. Crie usuários reais.
3. Ajuste o perfil do admin inicial se ele não for mais necessário.

## Usuários e permissões

Perfis disponíveis:

- `ADMIN`: acesso total
- `TI`: gerenciamento operacional
- `GESTOR`: consulta e exportação
- `LEITURA`: somente consulta

O menu de usuários é visível apenas para `ADMIN`.

## Acesso pela rede local

- Web: `http://localhost:3001`
- API: `http://localhost:3000`
- pgAdmin: `http://localhost:5050`

Na rede local, use o IP da máquina que está hospedando o Docker e as portas configuradas no `.env`.

## Migrations

```powershell
cd apps/api
npx prisma migrate deploy
```

Nunca use `prisma migrate reset` em ambiente com dados.

## Seed

```powershell
cd apps/api
npx prisma db seed
```

## Backup manual

```powershell
.\scripts\backup-db.ps1
```

O arquivo é salvo em `backups/` com data e hora no nome.

## Restore

Validação sem alterar dados:

```powershell
.\scripts\restore-db.ps1 -BackupFile .\backups\inventario_ti-YYYYMMDD-HHMMSS.dump -DryRun
```

Restore real:

```powershell
.\scripts\restore-db.ps1 -BackupFile .\backups\inventario_ti-YYYYMMDD-HHMMSS.dump -Force
```

O script exige confirmação explícita antes de sobrescrever o banco.

## Restore emergencial

1. Gere um backup novo.
2. Pare API e Web:

```powershell
docker compose stop api web
```

3. Rode `DryRun`.
4. Rode o restore real.
5. Suba API e Web novamente.

## Validações operacionais

```powershell
.\scripts\healthcheck.ps1
.\scripts\validate-postgres.ps1
.\scripts\validate-api.ps1
```

## Checklist de produção

- `.env` real configurado
- `JWT_SECRET` trocado
- senhas do PostgreSQL, pgAdmin e admin inicial trocadas
- Docker subido
- migrations executadas
- seed executado
- usuários reais criados
- permissões testadas
- backup testado
- restore em `DryRun` testado
- acesso mobile/PWA testado
- QR Code testado
- anexos/uploads testados

## Comandos úteis

```powershell
docker compose logs -f api
docker compose logs -f web
docker compose down
```

