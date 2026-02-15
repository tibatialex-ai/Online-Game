# Server (NestJS + Prisma + PostgreSQL)

## Запуск через Docker Compose

Из корня репозитория выполните:

```bash
docker compose up --build
```

Будут подняты сервисы:
- `server` (NestJS) — http://localhost:3000
- `postgres` — localhost:5432
- `redis` — localhost:6379

При старте контейнера `server` автоматически:
1. генерируется Prisma Client,
2. применяются миграции Prisma в PostgreSQL,
3. запускается NestJS-приложение.

## Проверка endpoint `/health`

```bash
curl http://localhost:3000/health
```

Ожидаемый ответ:

```json
{ "ok": true }
```

## Проверка endpoint `/db-check`

```bash
curl http://localhost:3000/db-check
```

Ожидаемый ответ на чистой базе:

```json
{ "usersCount": 0 }
```
