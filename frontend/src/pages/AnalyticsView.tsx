import React, { useState, useEffect } from 'react';
import { Activity, Users, AlertCircle, Globe } from 'lucide-react';
import { Card } from '../components/Card';
import { deviceService, Device } from '../services/device.service';
import { socketService } from '../services/socket.service';
import { theme } from '../styles/theme';

export const AnalyticsView: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await deviceService.getDevices();
        setDevices(data);
      } catch {
        setDevices([]);
      }
    };
    load();
    const unsub = socketService.onDeviceUpdate((updated: unknown) => {
      const payload = updated as Record<string, unknown>;
      const id = (payload?.id ?? payload?.deviceId) as string | undefined;
      if (!id) return;
      setDevices(prev => {
        const idx = prev.findIndex(d => d.id === id);
        const next = { ...payload, id } as Device;
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

  const status = (d: Device) => d.status || 'offline';
  const stats = {
    total: devices.length,
    online: devices.filter(d => status(d) === 'online').length,
    offline: devices.filter(d => status(d) === 'offline').length,
    locked: devices.filter(d => status(d) === 'locked').length,
    activeUrlCount: devices.filter(d => d.currentUrl && d.currentUrl !== 'about:blank').length
  };

  const StatCard: React.FC<{ title: string; value: number | string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing[1] }}>{title}</p>
          <div style={{ fontSize: theme.typography.fontSize['3xl'], fontWeight: 'bold', color: theme.colors.text.primary }}>
            {value}
          </div>
        </div>
        <div style={{
          padding: theme.spacing[3],
          borderRadius: theme.borderRadius.full,
          backgroundColor: `${color}15`,
          color: color
        }}>
          {icon}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[6] }}>
      <div>
        <h1 style={{
          fontSize: theme.typography.fontSize['3xl'],
          fontWeight: theme.typography.fontWeight.bold,
          color: theme.colors.text.primary,
          marginBottom: theme.spacing[2]
        }}>
          Analíticos
        </h1>
        <p style={{ color: theme.colors.text.secondary }}>
          Visão geral do uso dos dispositivos e engajamento.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: theme.spacing[6] }}>
        <StatCard
          title="Dispositivos Totais"
          value={stats.total}
          icon={<Users size={24} />}
          color={theme.colors.primary[500]}
        />
        <StatCard
          title="Online Agora"
          value={stats.online}
          icon={<Activity size={24} />}
          color={theme.colors.success[500]}
        />
        <StatCard
          title="Em Navegação Ativa"
          value={stats.activeUrlCount}
          icon={<Globe size={24} />}
          color={theme.colors.secondary[500]}
        />
        <StatCard
          title="Bloqueados"
          value={stats.locked}
          icon={<AlertCircle size={24} />}
          color={theme.colors.danger[500]}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: theme.spacing[6] }}>
        <Card>
          <h3 style={{ fontSize: theme.typography.fontSize.lg, fontWeight: 'bold', marginBottom: theme.spacing[4] }}>Atividade Recente</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: theme.spacing[2], color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.xs }}>DISPOSITIVO</th>
                <th style={{ textAlign: 'left', padding: theme.spacing[2], color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.xs }}>ATIVIDADE</th>
                <th style={{ textAlign: 'right', padding: theme.spacing[2], color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.xs }}>HORÁRIO</th>
              </tr>
            </thead>
            <tbody>
              {devices.slice(0, 5).map(device => (
                <tr key={device.id} style={{ borderBottom: `1px solid ${theme.colors.border.subtle}` }}>
                  <td style={{ padding: theme.spacing[3], fontWeight: 500 }}>{device.name || device.id}</td>
                  <td style={{ padding: theme.spacing[3] }}>
                    {device.currentUrl ? (
                      <span style={{ color: theme.colors.primary[500] }}>
                        {(() => {
                          try {
                            return `Acessou ${new URL(device.currentUrl).hostname}`;
                          } catch {
                            return device.currentUrl;
                          }
                        })()}
                      </span>
                    ) : (
                      <span style={{ color: theme.colors.text.tertiary }}>Ocioso</span>
                    )}
                  </td>
                  <td style={{ padding: theme.spacing[3], textAlign: 'right', color: theme.colors.text.secondary }}>
                    {new Date(Number(device.lastSeen) || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h3 style={{ fontSize: theme.typography.fontSize.lg, fontWeight: 'bold', marginBottom: theme.spacing[4] }}>Status da Frota</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
            <div style={{ display: 'flex', gap: 4, height: '100%', alignItems: 'flex-end' }}>
              <div style={{ width: 40, height: `${(stats.online / (stats.total || 1)) * 100}%`, backgroundColor: theme.colors.success[500], borderRadius: '4px 4px 0 0', transition: 'height 1s' }} title="Online" />
              <div style={{ width: 40, height: `${(stats.offline / (stats.total || 1)) * 100}%`, backgroundColor: theme.colors.neutral[400], borderRadius: '4px 4px 0 0', transition: 'height 1s' }} title="Offline" />
              <div style={{ width: 40, height: `${(stats.locked / (stats.total || 1)) * 100}%`, backgroundColor: theme.colors.danger[500], borderRadius: '4px 4px 0 0', transition: 'height 1s' }} title="Locked" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: theme.spacing[4], marginTop: theme.spacing[4] }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: theme.typography.fontSize.xs }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: theme.colors.success[500] }} /> Online
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: theme.typography.fontSize.xs }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: theme.colors.neutral[400] }} /> Offline
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: theme.typography.fontSize.xs }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: theme.colors.danger[500] }} /> Locked
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
