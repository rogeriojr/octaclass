// @ts-ignore
import { Server, Socket } from 'socket.io';
import { formatDeviceForSocket } from '../utils/formatDevice';

export class Gateway {
  private io: Server;
  private deviceSockets: Map<string, Socket> = new Map();

  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
      }
    });

    this.io.on('connection', (socket: Socket) => {
      socket.on('REGISTER_DEVICE', (deviceId: string) => {
        this.deviceSockets.set(deviceId, socket);
        socket.join(deviceId);
      });

      socket.on('DEVICE_HEARTBEAT', async (data: { deviceId: string; timestamp?: number; currentUrl?: string }) => {
        const { deviceId, currentUrl } = data;
        const prisma = (await import('../prisma')).default;
        const { updateDeviceHeartbeat } = await import('../utils/deviceUpdate');

        try {
          await updateDeviceHeartbeat(prisma, deviceId, {
            lastSeen: new Date(),
            status: 'online',
            currentUrl: typeof currentUrl === 'string' ? currentUrl : undefined
          });
          const device = await prisma.device.findUnique({
            where: { deviceId },
            include: { policy: true }
          });
          if (device) {
            this.io.to('all_admins').emit('DEVICE_UPDATED', formatDeviceForSocket(device));
          }
        } catch {
        }
      });

      socket.on('disconnect', () => {
        for (const [deviceId, s] of this.deviceSockets.entries()) {
          if (s.id === socket.id) {
            this.deviceSockets.delete(deviceId);
            break;
          }
        }
      });
    });
  }

  notifyDevice(deviceId: string, event: string, payload: any) {
    this.io.to(deviceId).emit(event, payload);
  }
}

let gatewayInstance: Gateway | null = null;

export const initGateway = (server: any) => {
  if (!gatewayInstance) {
    gatewayInstance = new Gateway(server);
  }
  return gatewayInstance;
};

export const getGateway = () => {
  return gatewayInstance;
};
