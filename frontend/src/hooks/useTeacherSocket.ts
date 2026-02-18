import { useEffect, useState, useCallback } from 'react';
import { deviceService, Device } from '../services/device.service';
import { socketService } from '../services/socket.service';

export interface Student {
  socketId: string;
  deviceId: string;
  currentUrl?: string;
  lastScreenshot?: string;
  status: 'online' | 'offline' | 'locked';
  lastSeen?: number;
}

export const useTeacherSocket = () => {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const devices = await deviceService.getDevices();
        setStudents(devices.map((d: Device) => ({
          socketId: d.id,
          deviceId: d.id,
          currentUrl: d.currentUrl,
          status: (d.status || 'offline') as Student['status'],
          lastSeen: d.lastSeen
        })));
      } catch {
        setStudents([]);
      }
    };
    load();

    const unsub = socketService.onDeviceUpdate((updated: unknown) => {
      const d = updated as Record<string, unknown>;
      const id = (d?.id ?? d?.deviceId) as string | undefined;
      if (!id) return;
      setStudents(prev => {
        const idx = prev.findIndex(s => s.deviceId === id);
        const next: Student = {
          socketId: id,
          deviceId: id,
          currentUrl: d.currentUrl as string | undefined,
          status: (d.status as Student['status']) || 'offline',
          lastSeen: d.lastSeen as number | undefined
        };
        if (idx > -1) {
          const arr = [...prev];
          arr[idx] = { ...prev[idx], ...next };
          return arr;
        }
        return [...prev, next];
      });
    });
    return () => {
      unsub();
    };
  }, []);

  const sendCommand = useCallback(async (type: string, payload: Record<string, unknown> = {}, deviceId?: string) => {
    if (!deviceId) return;
    await deviceService.sendCommand(deviceId, type, payload);
  }, []);

  return { students, sendCommand };
};
