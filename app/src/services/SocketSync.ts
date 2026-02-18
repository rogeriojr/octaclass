import { io, Socket } from 'socket.io-client';

export interface Command {
  id: string;
  type: string;
  payload?: any;
  timestamp: number;
}

type ConnectionListener = (connected: boolean) => void;

class SocketSyncService {
  private socket: Socket | null = null;
  private deviceId: string;
  private socketUrl: string;
  private connectionListener: ConnectionListener | null = null;

  constructor(deviceId: string, socketUrl: string) {
    this.deviceId = deviceId;
    this.socketUrl = socketUrl;
  }

  setConnectionListener(listener: ConnectionListener | null) {
    this.connectionListener = listener;
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(this.socketUrl, {
      transports: ['websocket', 'polling'],
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      this.socket?.emit('REGISTER_DEVICE', this.deviceId);
      this.sendHeartbeat();
      this.connectionListener?.(true);
    });

    this.socket.on('disconnect', () => {
      this.connectionListener?.(false);
    });

    this.socket.on('connect_error', () => {
      this.connectionListener?.(false);
    });
  }

  listenToCommands(callback: (command: Command) => void) {
    this.socket?.on('COMMAND', (command: Command) => {
      callback(command);
    });
  }

  sendHeartbeat(info: any = {}) {
    if (this.socket?.connected) {
      this.socket.emit('DEVICE_HEARTBEAT', {
        deviceId: this.deviceId,
        timestamp: Date.now(),
        ...info
      });
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export default SocketSyncService;
