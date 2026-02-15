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

## Авторизация

> `nickname` должен быть уникальным.

### Регистрация

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "nickname": "player1",
    "password": "StrongPass123",
    "refCodeOptional": "AB12CD34EF"
  }'
```

Пример ответа:

```json
{
  "id": 1,
  "nickname": "player1",
  "refCode": "A1B2C3D4E5"
}
```

### Логин

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "nickname": "player1",
    "password": "StrongPass123"
  }'
```

Пример ответа:

```json
{
  "accessToken": "<JWT>"
}
```

### Текущий пользователь (`/me`)

```bash
curl http://localhost:3000/me \
  -H 'Authorization: Bearer <JWT>'
```

Пример ответа:

```json
{
  "nickname": "player1",
  "gameRating": 0,
  "mlmRating": 0,
  "subscription": null
}
```

## Кошелёк и ledger

Все endpoint'ы ниже требуют JWT в заголовке `Authorization: Bearer <JWT>`.

### Получить баланс (`GET /wallet`)

```bash
curl http://localhost:3000/wallet \
  -H 'Authorization: Bearer <JWT>'
```

Пример ответа:

```json
{
  "balanceToken": "0",
  "lockedToken": "0",
  "stakedToken": "0"
}
```

### Последние 50 операций (`GET /wallet/ledger`)

```bash
curl http://localhost:3000/wallet/ledger \
  -H 'Authorization: Bearer <JWT>'
```

Пример ответа:

```json
[
  {
    "id": 1,
    "type": "FAUCET",
    "amount": "25",
    "metaJson": {
      "source": "wallet.faucet"
    },
    "createdAt": "2026-02-15T11:00:00.000Z"
  }
]
```

### Dev-only faucet (`POST /wallet/faucet`)

> Доступно только в non-production окружении. `amount` должен быть строго больше 0.

```bash
curl -X POST http://localhost:3000/wallet/faucet \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <JWT>' \
  -d '{
    "amount": 25
  }'
```

Пример ответа:

```json
{
  "wallet": {
    "balanceToken": "25",
    "lockedToken": "0",
    "stakedToken": "0"
  },
  "ledgerEntry": {
    "id": 1,
    "type": "FAUCET",
    "amount": "25",
    "metaJson": {
      "source": "wallet.faucet"
    },
    "createdAt": "2026-02-15T11:00:00.000Z"
  }
}
```
