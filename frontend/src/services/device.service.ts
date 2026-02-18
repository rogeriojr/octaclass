import { API_BASE_URL } from '../config/api';

export interface Device {
  id: string;
  name?: string;
  model?: string;
  osVersion?: string;
  appVersion?: string;
  status: 'online' | 'offline' | 'locked';
  lastSeen: number;
  currentUrl?: string;
  batteryLevel?: number;
  brightness?: number;
  androidManagementName?: string | null;
  policies: {
    blockedDomains: string[];
    allowedApps: string[];
    blockedApps?: string[];
    screenshotInterval: number;
    kioskMode: boolean;
    hasUnlockPin?: boolean;
  };
}

export const deviceService = {
  async getDevices(): Promise<Device[]> {
    const res = await fetch(`${API_BASE_URL}/devices`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },

  async getDevice(id: string): Promise<Device | null> {
    const res = await fetch(`${API_BASE_URL}/devices/${id}`);
    if (!res.ok) return null;
    return res.json();
  },

  async sendCommand(deviceId: string, type: string, payload: Record<string, unknown> = {}): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/devices/${deviceId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload })
    });
    if (!res.ok) throw new Error(await res.text());
  },

  async sendCommandToAll(deviceIds: string[], type: string, payload: Record<string, unknown> = {}): Promise<void> {
    await Promise.all(deviceIds.map((id) => this.sendCommand(id, type, payload)));
  },

  async getScreenshotHistory(deviceId: string): Promise<unknown[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/screenshots/history/${deviceId}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  async getDeviceAuditLogs(deviceId: string): Promise<unknown[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/devices/${deviceId}/audit`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }
};
