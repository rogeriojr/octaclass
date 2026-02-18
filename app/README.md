# Octaclass – App Android

App instalado no tablet do aluno: registra o dispositivo na API, recebe comandos (bloquear tela, abrir app, brilho, volume, alertas), aplica políticas (domínios bloqueados, kiosk) e envia atividade em tempo real.

## Stack

- React Native (Expo), TypeScript
- Módulos nativos (KioskModule): lock, kiosk, launch app, brilho, volume
- Foreground service (MdmSyncService): comandos e políticas com app em segundo plano
- Socket.io para comandos em tempo real quando o app está aberto

## Como rodar

1. **Configurar host da API**: copie `app/.env.example` para `app/.env` e defina `EXPO_PUBLIC_BACKEND_HOST` (IP do PC na rede ou `10.0.2.2` no emulador). Ou na raiz: `npm run setup` (sobrescreve `app/.env`).

2. **Prebuild (obrigatório na primeira vez ou após alterar código em `android-src` ou no plugin)**:
   ```bash
   cd app
   npm install
   npx expo prebuild --clean
   ```
   O prebuild regera a pasta `android/` e o config plugin injeta o código nativo (KioskModule, DeviceAdminReceiver, MdmSyncService) a partir de `android-src/`. Sem isso o app não terá as funções MDM.

3. **Build e execução**:
   ```bash
   npm run android
   ```
   Ou na raiz: `npm run app:android`. Aguarde o app abrir no dispositivo ou emulador.

4. Ao abrir, o app chama `POST /api/devices/register` e aparece no painel. Use o painel para enviar comandos e políticas.

## Device Owner

Para lock, kiosk e bloqueio de desinstalação funcionarem de forma plena, o app precisa ser **Device Owner**. Sem isso, o painel e a API seguem funcionando, mas parte dos comandos nativos pode falhar ou depender do fabricante.

**Pré-requisitos:** dispositivo **sem contas Google** (ou factory reset sem adicionar conta).

**Ordem dos passos (obrigatório):**

1. **Rodar o app primeiro** (instala e deixa o pacote ativo):
   ```bash
   cd app
   npm run android
   ```
   Ou na raiz: `npm run app:android`. Aguarde o app abrir no dispositivo/emulador.

2. **Definir o app como Device Owner** (dispositivo conectado via USB):
   ```bash
   adb shell dpm set-device-owner com.octoclass.mobile/.DeviceAdminReceiver
   ```
   Se aparecer "Not allowed to set the device owner": confira (a) não há nenhuma conta no dispositivo; (b) o app está instalado e já foi aberto ao menos uma vez; (c) em alguns aparelhos desative "Ativação do dispositivo" (provisioning) antes.

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

Para emulador (`adb reverse`), prebuild e demais detalhes, veja o **README na raiz do projeto**.

## Prebuild

- **Quando usar**: na primeira vez que for rodar o app no Android, ou sempre que alterar arquivos em `android-src/` ou no plugin `plugins/withKioskMode.js`.
- **Comando**: `npx expo prebuild --clean` (dentro da pasta `app/`).
- **O que faz**: apaga a pasta `android/` gerada e regera o projeto nativo. O config plugin `withKioskMode` roda nesse processo e copia o código de `android-src/com/octoclass/mobile/` para o projeto, além de ajustar `MainApplication` e `AndroidManifest`. Por isso o app continua com Device Admin, Kiosk e MdmSyncService após o prebuild.

## Estrutura

- `src/` – Telas, hooks (useDeviceSync), navegação
- `android-src/` – Código Java nativo (KioskModule, MdmSyncService, DeviceAdminReceiver) injetado no prebuild
- Políticas e comandos são aplicados pelo app e pelo MdmSyncService (polling quando em background).

Variáveis de ambiente: ver README na raiz.
