# Octaclass API – Referência REST

Base: `http://localhost:3005`. Documentação interativa: `/api-docs`.

## Autenticação

### POST /api/auth/register

Criar usuário. Body: `{ name, email, password, role }` (role: `student` ou `teacher`).

### POST /api/auth/login

Login. Body: `{ email, password }`. Resposta: `{ token, user }`. Use header `Authorization: Bearer <token>` nas rotas protegidas.

### GET /api/auth/users

Listar usuários (requer autenticação conforme uso no projeto).

---

## Dispositivos – /api/devices

- **POST /api/devices/register** – Registrar dispositivo (deviceId, name, model, osVersion, appVersion).
- **GET /api/devices** – Listar dispositivos.
- **GET /api/devices/:deviceId** – Obter um dispositivo.
- **PUT /api/devices/:deviceId/heartbeat** – Heartbeat (body opcional: `currentUrl`).
- **PUT /api/devices/:deviceId/policies** – Atualizar política do dispositivo.
- **DELETE /api/devices/:deviceId** – Remover dispositivo.
- **POST /api/devices/:deviceId/commands** – Enviar comando (body: `{ type, payload }`).
- **GET /api/devices/:deviceId/commands/pending** – Comandos pendentes.
- **POST /api/devices/:deviceId/commands/ack** – Confirmar consumo (body: `{ commandIds }`).
- **GET /api/devices/:deviceId/audit** – Log de auditoria.
- **POST /api/devices/:deviceId/activity** – Registrar atividade (body: `{ action, details }`).
- **GET /api/devices/:deviceId/activity** – Listar atividade (query: `limit`).
- **POST /api/devices/:deviceId/unlock-validate** – Validar PIN (body: `{ pin }`).
- **POST /api/devices/commands/broadcast** – Enviar comando para todos.

Rotas adicionais para Android Management (enroll, link, lock, reboot, reset-password) em `/api/devices/:deviceId/android-management/*`.

---

## Políticas – /api/policies

- **GET /api/policies** – Listar políticas.
- **GET /api/policies/:id** – Obter política.
- **POST /api/policies** – Criar política.
- **PUT /api/policies/:id** – Atualizar política.
- **DELETE /api/policies/:id** – Remover política.

---

## Políticas globais – /api/global-policies

- **GET /api/global-policies** – Obter política global.
- **PUT /api/global-policies** – Atualizar política global.
- **POST /api/global-policies/blacklist** – Adicionar domínio à blacklist.
- **DELETE /api/global-policies/blacklist/:domain** – Remover da blacklist.
- **POST /api/global-policies/whitelist** – Adicionar app à whitelist.
- **DELETE /api/global-policies/whitelist/:packageName** – Remover da whitelist.

---

## Screenshots – /api/screenshots

- **POST /api/screenshots/upload** – Upload de screenshot (multipart).
- **GET /api/screenshots/history/:deviceId** – Histórico por dispositivo.
- **GET /api/screenshots/:id** – Obter screenshot.
- **DELETE /api/screenshots/:id** – Excluir screenshot.

---

## Android Management – /api/android-management

Rotas para integração com Android Enterprise (signup-url, enterprise, policies, enrollment-tokens, devices, commands). Requer autenticação e configuração (GOOGLE_CLOUD_PROJECT_ID, GOOGLE_SERVICE_ACCOUNT_PATH). Detalhes em `/api-docs`.

---

## WebSocket / Socket.io

Usado para notificações em tempo real (atualização de dispositivos, comandos, atividade). Namespaces e eventos dependem do cliente (painel vs app). Ver implementação em `api/src/socket/`.
