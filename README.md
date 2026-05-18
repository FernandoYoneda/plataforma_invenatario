# Inventario TI - Casabella

MVP para controle interno de ativos de TI, com cadastro de ativos, funcionarios, categorias, localizacoes, atribuicoes, relatorios e auditoria basica.

## Documentação

- [Instalação e operação](./docs/INSTALL.md)
- [Mobile e PWA](./docs/MOBILE.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)

## Estrutura

- `apps/api`: API NestJS com Prisma e PostgreSQL.
- `apps/web`: frontend Next.js.
- `docker-compose.yml`: banco PostgreSQL e pgAdmin para uso local/interno.

O frontend usa a biblioteca `qrcode` para gerar QR Codes dos ativos diretamente no navegador.
Anexos de ativos sao salvos localmente em `uploads/assets`.

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

## Checklist de produção interna

Use esta sequência mínima antes de colocar o sistema em uso interno. A ordem abaixo evita subir ambiente com segredos padrão ou banco sem preparo.

1. Configure os arquivos de ambiente reais:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

2. Troque os valores padrão antes de subir qualquer serviço:

- `JWT_SECRET`
- senha do PostgreSQL
- senha do pgAdmin
- senha do admin inicial do seed

3. Revise as URLs e portas:

- `DATABASE_URL` da raiz deve apontar para o container `db`
- `CORS_ORIGIN` deve conter as origens reais do ambiente
- `NEXT_PUBLIC_API_URL` deve apontar para a API correta

4. Suba o Docker com os serviços base:

```powershell
docker compose up -d db pgadmin
```

5. Rode as migrations sem resetar o banco:

```powershell
docker compose run --rm api npx prisma migrate deploy
```

6. Rode o seed inicial:

```powershell
docker compose run --rm api npx prisma db seed
```

7. Suba API e Web:

```powershell
docker compose up -d api web
```

8. Crie usuários reais no painel `/users` e substitua o uso do admin inicial do seed sempre que possível.

9. Teste as permissões com perfis diferentes:

- `ADMIN`
- `TI`
- `GESTOR`
- `LEITURA`

10. Teste o fluxo operacional antes de liberar o acesso:

- login
- dashboard
- ativos
- funcionários
- auditoria
- relatórios
- QR Code
- anexos e uploads
- mobile e PWA

11. Gere um backup e valide restore em modo DryRun:

```powershell
.\scripts\backup-db.ps1
.\scripts\restore-db.ps1 -BackupFile .\backups\inventario_ti-AAAA-MM-DD-HHMMSS.dump -DryRun
```

12. Se o DryRun estiver correto, execute o restore real em janela controlada. Nunca use `prisma migrate reset` em ambiente com dados.

### Comandos principais em PowerShell

```powershell
docker compose up -d
docker compose run --rm api npx prisma migrate deploy
docker compose run --rm api npx prisma db seed
docker compose logs -f api
docker compose logs -f web
.\scripts\backup-db.ps1
.\scripts\restore-db.ps1 -BackupFile .\backups\inventario_ti-AAAA-MM-DD-HHMMSS.dump -DryRun
```

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
- Uploads da API: volume Docker `uploads_data`, montado em `/app/uploads`.

## Uploads de anexos

Os anexos enviados pela tela de detalhe do asset ficam em `uploads/assets` quando a API roda localmente. Essa pasta e ignorada pelo Git.

No Docker Compose, os uploads ficam no volume `uploads_data`, montado no container da API em `/app/uploads`. Preserve esse volume em backups ou migracoes de ambiente, junto com o backup do PostgreSQL.

Rotas de upload e exclusao sao restritas a usuarios `ADMIN`. Consulta e download exigem usuario autenticado.

## Backup e restore do banco

Os scripts usam o container Postgres `inventario_db` e leem `POSTGRES_USER` e `POSTGRES_DB` do `.env` da raiz. Os arquivos de backup sao salvos por padrao em `backups/`, pasta ignorada pelo Git.

### Backup manual

```powershell
.\scripts\backup-db.ps1
```

O nome segue o padrao `<banco>-YYYYMMDD-HHMMSS.dump`, por exemplo `inventario_ti-20260512-143000.dump`.

### Restore

Validar o arquivo sem alterar dados:

```powershell
.\scripts\restore-db.ps1 -BackupFile .\backups\inventario_ti-20260512-143000.dump -DryRun
```

Restore real com confirmacao interativa:

```powershell
.\scripts\restore-db.ps1 -BackupFile .\backups\inventario_ti-20260512-143000.dump -Force
```

O script pede para digitar `RESTAURAR` antes de sobrescrever o banco. Se a entrada nao bater, a operacao eh cancelada.

### Restore emergencial

1. Gere um backup novo antes de qualquer tentativa de restauracao.
2. Pare a API e o frontend se precisar evitar escritas durante a janela:

```powershell
docker compose stop api web
```

3. Execute primeiro o `DryRun`.
4. Se o `DryRun` estiver ok, rode o restore real com `-Force`.
5. Suba a API e o frontend novamente.

### Checklist pos-restore

- Conferir se a API responde na rota raiz.
- Logar com um usuario real.
- Validar dashboard, ativos, funcionarios e auditoria.
- Testar QR Code.
- Testar anexos e uploads.
- Validar acesso mobile/PWA.
- Checar se o arquivo restaurado corresponde ao backup esperado.

### Scripts operacionais

```powershell
.\scripts\healthcheck.ps1
.\scripts\validate-postgres.ps1
.\scripts\validate-api.ps1
.\scripts\backup-db.ps1
.\scripts\restore-db.ps1 -BackupFile .\backups\inventario_ti-YYYYMMDD-HHMMSS.dump -DryRun
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
