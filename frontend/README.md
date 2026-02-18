# Octaclass – Painel web

Interface do professor: login, lista de dispositivos, detalhe por dispositivo (políticas, comandos, atividade, screenshots).

## Stack

- React 18, TypeScript, Vite
- React Router, Axios, Socket.io-client
- Autenticação via API (JWT); login e cadastro em `POST /api/auth/login` e `POST /api/auth/register`
- Tema (claro/escuro) e componentes reutilizáveis

## Como rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:3030`. Requer a API rodando (ex.: `npm run dev` na raiz) para login e dados. O proxy aponta `/api` e WebSocket para o backend em `http://localhost:3005` (configure em `vite.config.ts` se usar outra porta). Variável opcional: `VITE_API_URL` (exemplo em `.env.example`).

## Build

```bash
npm run build
npm run preview
```

## Estrutura

- `src/pages/` – DeviceListView, DeviceDetailView, PoliciesView, AnalyticsView, Login
- `src/services/` – API (devices, auth, policies, screenshots)
- `src/contexts/` – Theme, Socket
- `src/components/` – Button, Input, NotificationCenter, etc.

O painel consome a API REST e Socket.io para atualizações em tempo real (dispositivos, atividade, notificações).
