# Troubleshooting

Guia rápido para problemas comuns do Inventário TI Casabella.

## A aplicação não sobe no Docker

Verifique:

- arquivo `.env` na raiz existe
- `POSTGRES_PASSWORD` está preenchido
- `JWT_SECRET` está preenchido
- `NEXT_PUBLIC_API_URL` está correto

Comandos:

```powershell
docker compose ps
docker compose logs -f db
docker compose logs -f api
docker compose logs -f web
```

## Migration falha

Use somente:

```powershell
cd apps/api
npx prisma migrate deploy
```

Não use `prisma migrate reset`.

## Seed falha

Confira:

- conexão com PostgreSQL
- `DATABASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Depois rode novamente:

```powershell
cd apps/api
npx prisma db seed
```

## Login falha

Verifique:

- `JWT_SECRET`
- usuário inativo
- senha inicial trocada
- `NEXT_PUBLIC_API_URL`

## QR Code não abre o detalhe

Confira:

- a página `/assets/[id]` existe e carrega
- a URL configurada no QR Code está correta
- o ativo possui `id`

## Upload/anexos não funcionam

Verifique:

- perfil do usuário
- pasta `uploads/assets`
- volume Docker `uploads_data`
- espaço em disco

## Restore falha

Use primeiro `DryRun`:

```powershell
.\scripts\restore-db.ps1 -BackupFile .\backups\arquivo.dump -DryRun
```

Se o arquivo não existir, o script para com mensagem amigável.

## API responde, mas o frontend não carrega

Confira:

- `NEXT_PUBLIC_API_URL`
- CORS da API
- se a Web foi reconstruída depois de mudar variáveis

## O sistema parece inconsistente após restore

Faça esta checagem:

1. login com usuário real
2. dashboard
3. ativos
4. funcionários
5. auditoria
6. relatório
7. QR Code
8. anexos/uploads

