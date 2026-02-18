import AndroidManagementService from './android-management.service';

let instance: AndroidManagementService | null = null;

/**
 * Retorna a instância única do Android Management API service.
 * Usado por rotas de android-management e por devices (lock, reboot, reset-password).
 * Credenciais via GOOGLE_SERVICE_ACCOUNT_PATH e GOOGLE_CLOUD_PROJECT_ID.
 */
export function getAndroidManagementService(): AndroidManagementService | null {
  if (instance !== null) return instance;

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || '';
  if (!projectId) return null;

  const serviceAccountPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './google-service-account.json';

  try {
    instance = new AndroidManagementService(serviceAccountPath, projectId);
    return instance;
  } catch (error: any) {
    return null;
  }
}
