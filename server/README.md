# Server (NestJS)

## Запуск через Docker Compose

Из корня репозитория выполните:

```bash
docker compose up --build
```

Будут подняты сервисы:
- `server` (NestJS) — http://localhost:3000
- `postgres` — localhost:5432
- `redis` — localhost:6379

## Проверка endpoint `/health`

### Через браузер
Откройте:

- http://localhost:3000/health

Ожидаемый ответ:

```json
{ "ok": true }
```

### Через curl

```bash
curl http://localhost:3000/health
```
