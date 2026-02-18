/**
 * Em dev usa /api para o proxy do Vite (vite.config.ts) encaminhar ao backend na 3005.
 * Assim evita ERR_CONNECTION_REFUSED direto à 3005 e centraliza requisições na mesma origem.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '/api' : '/api');

export const getScreenshotUrl = (screenshotId: string): string =>
  `${API_BASE_URL}/screenshots/${screenshotId}`;
