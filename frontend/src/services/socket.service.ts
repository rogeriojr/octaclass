import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/api';

function getSocketUrl(): string {
  if (typeof window !== 'undefined' && API_BASE_URL.startsWith('/')) {
    return window.location.origin;
  }
  const base = API_BASE_URL.replace(/\/api\/?$/, '');
  return base || window.location?.origin || 'http://localhost:3005';
}

class SocketService {
  private socket: Socket;

  constructor() {
    const url = getSocketUrl();
    this.socket = io(url, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 3000
    });

    this.socket.on('connect', () => {
      this.socket.emit('REGISTER_DEVICE', 'all_admins');
    });

    this.socket.on('connect_error', () => {
      // Evita log excessivo; UI pode checar isConnected()
    });
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  onDeviceUpdate(callback: (device: unknown) => void) {
    this.socket.on('DEVICE_UPDATED', callback);
    return () => this.socket.off('DEVICE_UPDATED');
  }

  onDeviceActivity(callback: (payload: { deviceId: string; deviceName?: string; action: string; details?: string; timestamp: string }) => void) {
    this.socket.on('DEVICE_ACTIVITY', callback);
    return () => this.socket.off('DEVICE_ACTIVITY');
  }

  async sendCommand(deviceId: string, type: string, payload: Record<string, unknown> = {}) {
    const response = await fetch(`${API_BASE_URL}/devices/${deviceId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  }

  getSocket() {
    return this.socket;
  }
}

export const socketService = new SocketService();
