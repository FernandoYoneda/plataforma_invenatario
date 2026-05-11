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

### API `apps/api/.env`

Usado pelo backend, Prisma e seed:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`
- `PORT`

Mantenha a senha do `DATABASE_URL` alinhada com `POSTGRES_PASSWORD`.

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
