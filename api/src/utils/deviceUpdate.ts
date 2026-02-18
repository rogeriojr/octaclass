import type { PrismaClient } from '@prisma/client';

export type DeviceHeartbeatData = {
  lastSeen: Date;
  status: string;
  currentUrl?: string | null;
};

/**
 * Atualiza lastSeen, status e opcionalmente currentUrl do device via SQL bruto.
 * Usado enquanto o cliente Prisma gerado não incluir o campo currentUrl (após prisma generate).
 */
export async function updateDeviceHeartbeat(
  prisma: PrismaClient,
  deviceId: string,
  data: DeviceHeartbeatData
): Promise<void> {
  const { lastSeen, status, currentUrl } = data;
  await prisma.$executeRaw`
    UPDATE Device
    SET lastSeen = ${lastSeen.toISOString()}, status = ${status}, currentUrl = ${currentUrl ?? null}
    WHERE deviceId = ${deviceId}
  `;
}
