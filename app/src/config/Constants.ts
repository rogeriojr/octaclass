/** Emulador: 10.0.2.2. Dispositivo físico: EXPO_PUBLIC_BACKEND_HOST=IP_DO_PC. No emulador: EXPO_PUBLIC_BACKEND_USE_EMULATOR=true */
const useEmulator =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_USE_EMULATOR === 'true';
const envHost =
  typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_BACKEND_HOST : undefined;
const BACKEND_HOST_VAL =
  useEmulator ? '10.0.2.2' : (envHost && envHost.length > 0 ? envHost : '10.0.2.2');
const BACKEND_PORT_VAL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_PORT) ||
  '3005';

export const BACKEND_IP = BACKEND_HOST_VAL;
export const BACKEND_PORT = BACKEND_PORT_VAL;
export const BACKEND_API_URL = `http://${BACKEND_HOST_VAL}:${BACKEND_PORT_VAL}/api`;
export const BACKEND_SOCKET_URL = `http://${BACKEND_HOST_VAL}:${BACKEND_PORT_VAL}`;

/** Android: navegador embutido (WebView) por padrão. Só use modo seguro (sem WebView) se EXPO_PUBLIC_ANDROID_SAFE_WEBVIEW=true */
export const ANDROID_FULL_BROWSER =
  typeof process === 'undefined' || process.env?.EXPO_PUBLIC_ANDROID_SAFE_WEBVIEW !== 'true';
