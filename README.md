# Octaclass

Sistema MDM (Mobile Device Management) para controle de dispositivos Android em ambiente educacional: painel web para o professor, app no tablet do aluno, API em tempo real e webhook para integrações.

## Visão geral

```
┌─────────────────┐     HTTP/WS      ┌─────────────┐     Socket.io      ┌─────────────────┐
│  Painel (web)   │ ◄──────────────► │     API     │ ◄───────────────► │  App (tablet)   │
│  frontend:3030  │                  │  api:3005   │                   │  React Native   │
└─────────────────┘                  └──────┬──────┘                   └────────┬────────┘
                                             │                                    │
                                             │ Prisma (SQLite)                    │ Device Owner
                                             │ WEBHOOK_URL (POST eventos)        │ Kiosk / Lock
                                             └────────────────────────────────────┘
```

- **API**: Node.js, Express, Prisma, Socket.io. Dispositivos, políticas, comandos, atividade, webhook.
- **Frontend**: React, Vite. Login, lista de dispositivos, detalhe por dispositivo (políticas, comandos, atividade, screenshots).
- **App**: React Native (Expo). Registro no servidor, recebe comandos (bloquear, abrir app, brilho, volume, alertas), envia heartbeat e atividade. Funciona com app em primeiro plano ou em segundo plano (foreground service).

## Arquivos e dados sensíveis

### O que não subir (já no `.gitignore`)

| Local | Arquivo(s) | Motivo |
|-------|------------|--------|
| API | `api/.env` | Credenciais e segredos da aplicação |
| API | `api/firebase-service-account.json` | Chave de conta de serviço (Firebase/Google) |
| App | `app/.env` | Host/porta do backend (pode expor sua rede) |
| App | `app/google-services.json` | Config do Firebase no cliente |
| App | `app/*-adminsdk-*.json` | Chaves de administrador Firebase |
| Raiz | `*.pem`, `*.p12`, `*.jks` | Certificados e keystores |

### O que são informações sensíveis

- **Credenciais**: `JWT_SECRET`, `DATABASE_URL` (se usar usuário/senha), tokens e chaves de API.
- **Contas de serviço**: JSONs do Firebase/Google (firebase-service-account, adminsdk) — dão acesso ao projeto na nuvem.
- **Rede**: `EXPO_PUBLIC_BACKEND_HOST` e porta — identificam onde está sua API; em produção use HTTPS e evite expor IPs internos no repositório.
- **Webhook**: `WEBHOOK_URL` pode conter token ou segredo na query string; não commitar.

### Configuração correta (sem commitar segredos)

1. **API**: copie `api/.env.example` para `api/.env`. Preencha `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` e, se usar, `WEBHOOK_URL`. Se o projeto usar Firebase/Google, coloque `firebase-service-account.json` em `api/` (obtenha no console do projeto ou com o time) — não commitar.
2. **App**: copie `app/.env.example` para `app/.env`. Defina `EXPO_PUBLIC_BACKEND_HOST` (IP do PC na rede ou `10.0.2.2` no emulador) e `EXPO_PUBLIC_BACKEND_PORT` (ex.: 3005). Para Firebase no app, use `google-services.json` e/ou arquivos adminsdk apenas localmente; não subir no repositório.
3. Para compartilhar com o time: envie `.env` e JSONs de conta por canal seguro (1Password, link com acesso restrito, etc.) ou documente internamente onde obter e como preencher conforme os `.env.example`. O projeto não utiliza Firebase na aplicação; se no futuro integrar, use os arquivos de conta sem commitá-los.

## Como rodar

### Pré-requisitos

- Node.js 18+
- npm 9+
- Android: Android Studio / SDK e `adb` no PATH (para app e Device Owner)

### Passos básicos (resumo)

1. **API e painel**: na raiz, `npm run dev` (sobe API em 3005 e frontend em 3030). Ou suba cada um: `cd api` → configurar `.env`, `npm install`, `npx prisma generate`, `npx prisma migrate deploy`, `npm run dev`; depois `cd frontend` → `npm install`, `npm run dev`.
2. **App**: copiar `app/.env.example` para `app/.env` (ou `npm run setup` na raiz). Na **primeira vez** ou após alterar código em `app/android-src` ou no plugin: `cd app && npx expo prebuild --clean`. Depois: `cd app && npm run android` (ou na raiz `npm run app:android`). Aguarde o app abrir no dispositivo/emulador.
3. **Device Owner** (para lock/kiosk/desinstalação): com o app já rodando e dispositivo conectado via USB: `adb shell dpm set-device-owner com.octoclass.mobile/.DeviceAdminReceiver`. Conferir: `adb shell dpm list-owners`. Ver logs do kiosk: `adb logcat -s KioskModule`.

### 1. API

```bash
cd api
cp .env.example .env
# Edite api/.env com DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

No Windows: `copy .env.example .env` (cmd) ou `Copy-Item .env.example .env` (PowerShell).

**Prisma:** a ordem é `npx prisma generate` (gera o cliente) e depois `npx prisma migrate deploy` (aplica migrations no banco). No Windows, se `prisma generate` falhar com *EPERM* (operation not permitted), pare a API (`Ctrl+C` no terminal onde está rodando) e rode `npx prisma generate` de novo; algum processo estava usando o engine do Prisma.

Servidor em `http://localhost:3005`. Swagger: `http://localhost:3005/api-docs`.

### 2. Frontend (painel)

```bash
cd frontend
npm install
npm run dev
```

Painel em `http://localhost:3030`. A tela de login já vem com usuário padrão preenchido (`professor@escola.com` / `123456`). Na primeira vez, use **Criar Conta** com esses dados (ou altere a senha) e depois faça login.

### 3. Subir tudo de uma vez (raiz do projeto)

```bash
npm run dev
```

Sobe API (3005) e frontend (3030).

### 4. App no tablet/emulador

- **Configurar ambiente**: copie `app/.env.example` para `app/.env` (ou na raiz `npm run setup`; isso sobrescreve `app/.env` com host e porta).
- **Prebuild (primeira vez ou após mudar código nativo)**: `cd app && npx expo prebuild --clean`. Isso regera a pasta `android/` e o config plugin injeta o código de `android-src` (Kiosk, DeviceAdmin, MdmSyncService). Só então rode o build.
- **Instalar e rodar**: `cd app && npm run android` (ou na raiz `npm run app:android`). **Rode o app primeiro** antes de configurar Device Owner.
- O app registra o dispositivo na API ao abrir (POST `/api/devices/register`). O painel lista o dispositivo e permite enviar comandos e políticas.
- **Device Owner** (lock, kiosk, bloqueio de desinstalação): siga a seção **App Android: Device Owner e logs** abaixo.

## App Android: comandos manuais e macetes

Comandos úteis para desenvolver e fazer o MDM funcionar de fato no dispositivo.

### Rodar o app (build nativo + Metro)

**Primeira vez ou após alterar `android-src` ou o plugin:** rode `npx expo prebuild --clean` dentro de `app/` para regerar o projeto Android com os módulos nativos (Kiosk, DeviceAdmin, MdmSyncService) injetados.

Depois, na raiz:
```bash
npm run app:android
```
Ou dentro do app:
```bash
cd app
npm run android
```
(Equivalente a `npx expo run:android`.)

### Ver logs do app e do kiosk

Com dispositivo/emulador conectado (`adb devices`):

- **Só logs do módulo nativo Kiosk** (recomendado para acompanhar lock/kiosk):
  ```bash
  adb logcat -s KioskModule
  ```
- **Todos os logs com timestamp:** `adb logcat -v time`
- **Filtrar por app e módulos:** `adb logcat -v time | findstr "Octaclass Kiosk MdmSync"` (Windows) ou `adb logcat -v time | grep -E "Octaclass|Kiosk|MdmSync"` (Linux/macOS).

A atividade (comandos, POLICY_CHANGE, kiosk) também aparece na aba **Atividade** do dispositivo no painel e no webhook `device.activity`.

### Emulador: redirecionar portas para a API no PC

Para o app no emulador acessar a API em `localhost` da máquina:
```bash
adb reverse tcp:3005 tcp:3005
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8082 tcp:8082
```
Em `app/.env` use `EXPO_PUBLIC_BACKEND_HOST=10.0.2.2` (emulador Android usa 10.0.2.2 para o host).

### App Android: Device Owner e logs

Para lock, kiosk e bloqueio de desinstalação funcionarem de forma plena, o app precisa ser **Device Owner**. Só é possível em dispositivo **sem contas Google** (ou após factory reset sem adicionar conta).

**Ordem dos passos (obrigatório):**

1. **Rodar o app primeiro** (instala e deixa o pacote ativo):
   ```bash
   cd app
   npm run android
   ```
   Ou na raiz: `npm run app:android`. Aguarde o app abrir no dispositivo/emulador.

2. **Definir o app como Device Owner** (com dispositivo conectado via USB):
   ```bash
   adb shell dpm set-device-owner com.octoclass.mobile/.DeviceAdminReceiver
   ```
   Se aparecer “Not allowed to set the device owner”, confira: (a) não há nenhuma conta no dispositivo; (b) o app está instalado e já foi aberto ao menos uma vez; (c) em alguns aparelhos desative “Ativação do dispositivo” (provisioning) antes.

3. **Conferir se deu certo:**
   ```bash
   adb shell dpm list-owners
   ```
   Deve listar `com.octoclass.mobile`.

4. **Acompanhar logs nativos do kiosk:**
   ```bash
   adb logcat -s KioskModule
   ```
   Use esse comando para ver em tempo real as chamadas ao módulo nativo (lock, kiosk, etc.).

Depois disso, o app passa a poder usar `DevicePolicyManager` (lock, setLockTaskPackages, setUninstallBlocked, etc.) como administrador do dispositivo.

### App em tela branca ou fechando sozinho

Se o app abrir em tela branca e depois fechar (voltando à tela inicial do Android) ou travar:

1. **API no ar:** confirme que a API está rodando (`http://localhost:3005` ou no IP em `app/.env`) e que o banco está ok (`npx prisma migrate deploy` na pasta `api`).
2. **Conexão do app com a API:** emulador: `adb reverse tcp:3005 tcp:3005` e em `app/.env` use `EXPO_PUBLIC_BACKEND_HOST=10.0.2.2`. Em dispositivo físico use o IP do PC em `EXPO_PUBLIC_BACKEND_HOST`.
3. **Build nativo:** use `cd app && npm run android` (não Expo Go), principalmente para Device Owner e kiosk.
4. **Logs:** rode `adb logcat -v time` ou `adb logcat -s KioskModule` com o app aberto para ver erros de rede, módulo nativo ou JavaScript.

### Outros

- **Limpar cache do Metro**: `cd app && npx expo start --clear`.
- **Listar dispositivos conectados**: `adb devices`.
- Atividade em tempo real (comandos, kiosk, POLICY_CHANGE) continua visível na aba **Atividade** do dispositivo no painel web e no webhook `device.activity`.

## Funcionalidades principais

| Recurso | Onde | Descrição |
|--------|------|-----------|
| Registro de dispositivo | App → API | App envia deviceId, nome, modelo, versões. API cria/atualiza dispositivo e política padrão. |
| Lista e detalhe | Painel | Lista dispositivos; em cada um: políticas, comandos (bloquear, abrir app, brilho, volume, alerta), atividade, screenshots. |
| Políticas | Painel / API | Domínios bloqueados, apps permitidos/ocultos, intervalo de captura, modo kiosk, PIN de desbloqueio. |
| Comandos | Painel → API → App | LOCK_SCREEN (com ou sem PIN), UNLOCK_SCREEN, LAUNCH_APP, SET_BRIGHTNESS, VOLUME, GET_PRINT, REBOOT, ALERT, POLICY_CHANGE, START_KIOSK, STOP_KIOSK. |
| Atividade em tempo real | App → API → Painel | URL atual, comandos recebidos, tentativas de site bloqueado, etc. Via Socket.io e GET `/activity`. |
| Webhook | API | Se `WEBHOOK_URL` estiver definida, a API envia POST com `{ event, timestamp, ...payload }` para device.registered, device.heartbeat, device.activity, device.deleted, policy.updated, command.sent. |

## Modo Kiosk e Device Owner

- **Modo kiosk**: no painel, em “Tela e dispositivo”, use “Ativar modo kiosk”. O app (quando em primeiro plano) chama `startLockTask()` e o tablet fica restrito ao app. “Liberar Home” envia STOP_KIOSK e o app chama `stopLockTask()`.
- **Device Owner**: para controle avançado (bloquear desinstalação, lock, etc.), o app precisa ser Device Owner. Ordem: (1) rodar `npm run android` no app; (2) `adb shell dpm set-device-owner com.octoclass.mobile/.DeviceAdminReceiver`; (3) conferir com `adb shell dpm list-owners`; (4) logs nativos com `adb logcat -s KioskModule`. Detalhes na seção **App Android: Device Owner e logs**.
- **Logs do kiosk**: use `adb logcat -s KioskModule` para acompanhar só o módulo nativo, ou `adb logcat -v time` (filtre por Octaclass/Kiosk/MdmSync se quiser). A atividade do dispositivo (comandos recebidos, POLICY_CHANGE, START_KIOSK, STOP_KIOSK) aparece na aba “Atividade” do dispositivo no painel e é enviada ao webhook como `device.activity`.

## Variáveis de ambiente

| Onde | Variável | Uso |
|------|----------|-----|
| API | `DATABASE_URL` | SQLite, ex.: `file:./dev.db` |
| API | `JWT_SECRET` | Assinatura dos tokens |
| API | `WEBHOOK_URL` | URL opcional para POST de eventos |
| API | `CORS_ORIGIN` | Origens permitidas (ex.: `http://localhost:3030`) |
| App | `EXPO_PUBLIC_BACKEND_HOST` | IP/host da API (ex.: do seu PC na rede) |
| App | `EXPO_PUBLIC_BACKEND_PORT` | Porta da API (ex.: 3005) |

## Decisões técnicas

### Visão geral

- **Monorepo**: api, frontend e app na mesma raiz. Scripts na raiz: `dev` (sobe API + frontend), `setup` (preenche host do backend no app); ver `package.json` e pasta `scripts/`.
- **API**: Express, Prisma (SQLite por padrão), Socket.io para tempo real, webhook fire-and-forget. Documentação: `api/README.md`, `api/API.md`, Swagger em `/api-docs`.
- **Frontend**: React + Vite; login, lista/detalhe de dispositivos, políticas, comandos, atividade e screenshots.
- **App**: React Native (Expo) com código nativo Android para Device Policy e foreground service; abaixo o papel do nativo e da pasta `android-src`.

### Código nativo Android e pasta `app/android-src`

O app usa **Device Owner** e **Device Policy** (lock, kiosk, bloqueio de desinstalação, etc.). Essas APIs são nativas; no Expo isso é feito com um **config plugin** que injeta código Java no projeto Android no prebuild.

- **O que é a pasta `app/android-src`**  
  Contém o código-fonte Java que será copiado para o projeto Android gerado pelo `expo prebuild`. Estrutura esperada: `android-src/com/octoclass/mobile/` com:
  - `DeviceAdminReceiver.java` — receptor de Device Admin; necessário para `dpm set-device-owner`.
  - `KioskModule.java` — módulo nativo que expõe para o JS: lock, unlock, startLockTask/stopLockTask, setLockTaskPackages, launch app, etc.
  - `KioskModulePackage.java` — registra o módulo no React Native.
  - `MdmSyncService.java` — foreground service que mantém conexão com a API e processa comandos mesmo com o app em segundo plano.

- **Como funciona no build**  
  O plugin (`app/plugins/withKioskMode.js`) roda no `expo prebuild`: copia os `.java` de `android-src/com/octoclass/mobile/` para o diretório de fontes do app Android, altera `MainApplication` para registrar `KioskModulePackage` e ajusta o `AndroidManifest` (DeviceAdminReceiver, permissões, serviço). Depois disso, `expo run:android` compila o projeto Android normalmente.

- **Por que o `prebuild --clean` sempre inclui os módulos do kiosk**  
  O `--clean` só apaga a pasta `android/` (e `ios/`) gerada. Na sequência, o Expo regera o projeto nativo a partir do `app.json` e **executa de novo todos os config plugins** declarados em `plugins`. Como o `withKioskMode` está na lista, ele roda em todo prebuild: lê o código em `android-src/`, copia para o novo `android/app/src/...` e aplica as alterações no `MainApplication` e no `AndroidManifest`. Ou seja, a fonte do kiosk fica no repositório (`android-src/` + plugin); o que é “limpo” é só o resultado da geração anterior. Por isso, após qualquer `expo prebuild --clean`, o app continua com Device Admin, KioskModule e MdmSyncService.

- **Fluxo no app (JS ↔ nativo)**  
  O JavaScript (Expo) chama métodos do módulo nativo (ex.: lock, startKiosk, launchApp). O `KioskModule` usa `DevicePolicyManager` e `DeviceAdminReceiver`; o `MdmSyncService` escuta comandos da API e aciona o que for necessário (lock, kiosk, etc.), mesmo com a UI em background.

### Funcionalidades e onde vivem no código

| Funcionalidade | Onde está |
|----------------|-----------|
| Registro de dispositivo | App: chamada a POST `/api/devices/register`; API: rota + Prisma. |
| Lista/detalhe, políticas, comandos, atividade | Frontend: páginas e chamadas à API; API: rotas REST + Socket.io. |
| Lock / Unlock / Kiosk / Launch app | App JS envia ou reage a comandos; execução nativa em `KioskModule` e, em background, em `MdmSyncService`. |
| Políticas (domínios bloqueados, apps, PIN, intervalo de captura) | API: modelo e rotas; frontend: formulários; app: aplica políticas e reporta atividade. |
| Comandos em segundo plano | API envia via Socket; `MdmSyncService` (foreground service) recebe e executa (lock, kiosk, etc.). |
| Webhook | API: ao registrar dispositivo, heartbeat, atividade, etc., envia POST para `WEBHOOK_URL` se definida. |
| Screenshots / GET_PRINT | Comando do painel; app (ou módulo nativo) gera e envia para a API; frontend exibe. |

## Estrutura do repositório

```
api/              Backend (Express, Prisma, Socket.io)
frontend/         Painel web (React, Vite)
app/              App Android (React Native, Expo)
  android-src/    Código Java nativo (DeviceAdmin, Kiosk, MdmSyncService) injetado no prebuild
  plugins/        Config plugin Expo (withKioskMode.js) que copia android-src e ajusta Android
scripts/          start-all.js, setup-backend-host.js (dev, setup)
```

Documentação detalhada da API: [api/README.md](api/README.md). Referência dos endpoints: [api/API.md](api/API.md) e Swagger em `/api-docs`.
