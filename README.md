# Inventario TI - Casabella

MVP para controle interno de ativos de TI, com cadastro de ativos, funcionarios, categorias, localizacoes, atribuicoes, relatorios e auditoria basica.

## Estrutura

- `apps/api`: API NestJS com Prisma e PostgreSQL.
- `apps/web`: frontend Next.js.
- `docker-compose.yml`: banco PostgreSQL e pgAdmin para uso local/interno.

## Variaveis de ambiente

Os arquivos reais de ambiente nao devem ser versionados. Use os exemplos como base:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Preencha senhas e segredos antes de subir o ambiente.

### Raiz `.env`

Usado pelo Docker Compose:

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_PORT`
- `PGADMIN_DEFAULT_EMAIL`
- `PGADMIN_DEFAULT_PASSWORD`
- `PGADMIN_PORT`
- `API_PORT`
- `API_INTERNAL_PORT`
- `DATABASE_URL`
- `WEB_PORT`
- `WEB_INTERNAL_PORT`
- `NEXT_PUBLIC_API_URL`

### API `apps/api/.env`

Usado pelo backend, Prisma e seed:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`
- `PORT`

Mantenha a senha do `DATABASE_URL` alinhada com `POSTGRES_PASSWORD`.
No `.env` da raiz usado pelo Docker, `DATABASE_URL` deve apontar para `db:5432`.
Use `CORS_ORIGIN` com origens separadas por virgula, por exemplo `http://localhost:3001,http://localhost:3000`.
No `apps/api/.env` usado fora do Docker, `DATABASE_URL` normalmente aponta para `localhost:5434`.

### Web `apps/web/.env.local`

Usado pelo frontend:

- `NEXT_PUBLIC_API_URL`

## Subir banco

Na raiz do projeto:

```powershell
docker compose up -d
```

Em instalacoes antigas do Docker, use `docker-compose up -d`.

O PostgreSQL usa as variaveis do arquivo `.env` da raiz. O pgAdmin fica disponivel na porta configurada em `PGADMIN_PORT`.

## Rodar tudo via Docker

Na raiz do projeto, configure o `.env` a partir de `.env.example` e troque senhas/segredos.

Construa as imagens:

```powershell
docker compose build
```

Suba banco e pgAdmin:

```powershell
docker compose up -d db pgadmin
```

Rode migrations sem apagar dados:

```powershell
docker compose run --rm api npx prisma migrate deploy
```

Rode o seed inicial:

```powershell
docker compose run --rm api npx prisma db seed
```

Suba API e Web:

```powershell
docker compose up -d api web
```

Em instalacoes antigas do Docker, substitua `docker compose` por `docker-compose`.

### Acessos Docker

- Web: `http://localhost:3001`, ou porta definida em `WEB_PORT`.
- API: `http://localhost:3000`, ou porta definida em `API_PORT`.
- pgAdmin: `http://localhost:5050`, ou porta definida em `PGADMIN_PORT`.
- PostgreSQL no host: `localhost:5434`, ou porta definida em `POSTGRES_PORT`.
- PostgreSQL dentro da rede Docker: host `db`, porta `5432`.

## Backup e restore do banco

Os scripts usam o container Postgres `inventario_db` e leem `POSTGRES_USER` e `POSTGRES_DB` do `.env` da raiz. Os arquivos de backup sao salvos em `backups/`, pasta ignorada pelo Git.

Gerar backup:

```powershell
.\scripts\backup-db.ps1
```

O arquivo gerado usa data e hora no nome, por exemplo `backups/inventario_ti-20260512-143000.dump`.

Validar um restore sem alterar dados:

```powershell
.\scripts\restore-db.ps1 -BackupFile .\backups\inventario_ti-20260512-143000.dump -DryRun
```

Restaurar backup:

```powershell
.\scripts\restore-db.ps1 -BackupFile .\backups\inventario_ti-20260512-143000.dump -Force
```

Atencao: restore pode sobrescrever dados do banco atual. Antes de restaurar, gere um backup novo e pare API/Web se quiser evitar escritas durante a operacao:

```powershell
docker-compose stop api web
```

## Rodar migrations

```powershell
cd apps/api
npm install
npx prisma migrate deploy
```

Nao use `prisma migrate reset` sem confirmacao, pois ele apaga dados.

## Rodar seed

```powershell
cd apps/api
npx prisma db seed
```

O seed cria ou atualiza o usuario admin com `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ADMIN_NAME`.

## Rodar backend

```powershell
cd apps/api
npm run start:dev
```

## Rodar frontend

```powershell
cd apps/web
npm install
npm run dev
```

## Rotas principais

- `/login`
- `/dashboard`
- `/assets`
- `/employees`
- `/categories`
- `/locations`
- `/reports`
- `/audit`

## Validacao

```powershell
cd apps/api
npm run build
```

```powershell
cd apps/web
npx tsc --noEmit
```

## Seguranca

- `.env`, `.env.*` e `.env.local` continuam ignorados pelo Git.
- `.env.example` pode ser versionado e nao deve conter segredos reais.
- Troque `JWT_SECRET`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD` e `PGADMIN_DEFAULT_PASSWORD` antes de uso interno compartilhado.
