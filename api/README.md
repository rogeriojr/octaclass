# Octaclass MDM – API

Backend para gerenciamento de dispositivos (MDM): dispositivos, políticas, comandos e atividade em tempo real.

## Stack

- **Node.js** + **TypeScript**
- **Express** – servidor HTTP
- **Prisma** – ORM (SQLite)
- **Socket.io** – eventos em tempo real
- **Swagger** – documentação em `/api-docs`
- **JWT** – autenticação
- **Helmet** + **rate limiting** – segurança

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL do banco (ex.: `file:./dev.db`) |
| `JWT_SECRET` | Chave para assinatura de tokens |
| `WEBHOOK_URL` | URL opcional para receber eventos (POST JSON) |
| `CORS_ORIGIN` | Origens permitidas (ex.: `http://localhost:3030`) |

## Como rodar

```bash
cp .env.example .env
# Edite .env com DATABASE_URL, JWT_SECRET, CORS_ORIGIN, WEBHOOK_URL (opcional)
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

No Windows: `copy .env.example .env` (cmd) ou `Copy-Item .env.example .env` (PowerShell).

**Scripts Prisma:** `npm run db:generate` (equivale a `npx prisma generate`) e `npm run db:migrate` (equivale a `npx prisma migrate deploy`). Se `prisma generate` der *EPERM* no Windows, pare o servidor da API e rode o comando de novo.

Servidor em `http://localhost:3005`. Documentação interativa: **http://localhost:3005/api-docs**.

## Webhook

Se `WEBHOOK_URL` estiver definida, a API envia um `POST` com JSON para cada evento. Formato: `{ event, timestamp, ...payload }`.

| Evento | Quando | Payload (resumo) |
|--------|--------|-------------------|
| `device.registered` | Após POST `/devices/register` | deviceId, name, model, osVersion, appVersion |
| `device.heartbeat` | Após PUT `/devices/:id/heartbeat` | deviceId, lastSeen, currentUrl, status |
| `device.activity` | Após POST `/devices/:id/activity` | deviceId, deviceName, action, details, logId |
| `device.deleted` | Após DELETE `/devices/:id` | deviceId |
| `policy.updated` | Após PUT política do dispositivo | deviceId, kioskMode, hasUnlockPin, contagens (blockedDomains, allowedApps, blockedApps) |
| `command.sent` | Após POST comando para dispositivo | deviceId, type, payload |

Dados sensíveis (ex.: PIN de desbloqueio) não são enviados; apenas flags como `hasUnlockPin`.
