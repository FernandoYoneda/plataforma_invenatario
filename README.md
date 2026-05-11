# Inventario TI - Casabella

MVP para controle interno de ativos de TI, com cadastro de ativos, funcionarios, categorias, localizacoes, atribuicoes, relatorios e auditoria basica.

## Estrutura

- `apps/api`: API NestJS com Prisma e PostgreSQL.
- `apps/web`: frontend Next.js.
- `docker-compose.yml`: banco PostgreSQL e pgAdmin para desenvolvimento local.

## Variaveis de ambiente

Crie os arquivos locais conforme necessario. Eles nao devem ser versionados.

`apps/api/.env`

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5434/inventario_ti?schema=public"
JWT_SECRET="defina-um-segredo-local"
PORT=3000
```

`apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL="http://localhost:3000"
```

## Setup local

```bash
docker compose up -d
```

```bash
cd apps/api
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

```bash
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

```bash
cd apps/api
npm run build
```

```bash
cd apps/web
npx tsc --noEmit
```

## Observacoes de seguranca

- `.env`, `.env.*` e arquivos locais de ambiente ficam ignorados pelo Git.
- As credenciais do `docker-compose.yml` e do seed sao defaults de desenvolvimento; troque antes de qualquer uso fora do ambiente local.
