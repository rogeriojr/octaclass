import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Lock, Power, CloudOff, Smartphone, MessageSquare, Globe, AppWindow } from 'lucide-react';
import { deviceService, Device } from '../services/device.service';
import { socketService } from '../services/socket.service';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { theme } from '../styles/theme';
import { API_BASE_URL } from '../config/api';

const ALERT_PRESETS: { label: string; message: string }[] = [
  { label: 'Preste atenção na aula!', message: 'Preste atenção na aula!' },
  { label: 'Volte ao conteúdo da aula', message: 'Volte ao conteúdo da aula.' },
  { label: 'Guarde o celular/tablet', message: 'Guarde o celular/tablet e acompanhe a explicação.' },
  { label: 'Silêncio, por favor', message: 'Silêncio, por favor.' },
  { label: 'Avaliação em andamento', message: 'Avaliação em andamento. Mantenha o foco.' },
  { label: 'Personalizada', message: '' }
];

const APP_PRESETS: { label: string; package: string }[] = [
  { label: 'Chrome', package: 'com.android.chrome' },
  { label: 'YouTube', package: 'com.google.android.youtube' },
  { label: 'Play Store', package: 'com.android.vending' },
  { label: 'Calculadora', package: 'com.android.calculator2' },
  { label: 'Octoclass', package: 'com.octaclass.mobile' },
  { label: 'Keep', package: 'com.google.android.keep' },
  { label: 'Gmail', package: 'com.google.android.gm' },
  { label: 'Drive', package: 'com.google.android.apps.docs' },
  { label: 'Maps', package: 'com.google.android.apps.maps' },
  { label: 'Google', package: 'com.google.android.googlequicksearchbox' },
  { label: 'Fotos', package: 'com.google.android.apps.photos' },
  { label: 'Contatos', package: 'com.android.contacts' },
  { label: 'Calendário', package: 'com.google.android.calendar' },
  { label: 'Relógio', package: 'com.google.android.deskclock' },
  { label: 'Mensagens', package: 'com.google.android.apps.messaging' },
  { label: 'Telefone', package: 'com.android.dialer' },
  { label: 'Arquivos', package: 'com.google.android.apps.nbu.files' },
  { label: 'YouTube Music', package: 'com.google.android.apps.youtube.music' },
  { label: 'Meet', package: 'com.google.android.apps.tachyon' },
  { label: 'Outro (digitar pacote)', package: '' }
];

type FilterStatus = 'all' | 'online' | 'offline' | 'locked';
type SortField = 'name' | 'lastSeen' | 'status' | 'model';
type SortDirection = 'asc' | 'desc';

export const DeviceListView: React.FC = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [sortField] = useState<SortField>('lastSeen');
  const [sortDirection] = useState<SortDirection>('desc');
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [globalTarget, setGlobalTarget] = useState<'all' | string>('all');
  const [alertPresetIndex, setAlertPresetIndex] = useState(0);
  const [alertCustomMessage, setAlertCustomMessage] = useState('');
  const [globalUrl, setGlobalUrl] = useState('');
  const [globalAppPresetIndex, setGlobalAppPresetIndex] = useState(0);
  const [globalPackageCustom, setGlobalPackageCustom] = useState('');
  const [sendingCommand, setSendingCommand] = useState(false);

  const resolvedGlobalPackage = globalAppPresetIndex < APP_PRESETS.length - 1
    ? APP_PRESETS[globalAppPresetIndex].package
    : globalPackageCustom.trim();

  const broadcastCommand = async (type: string, payload: Record<string, unknown> = {}) => {
    setSendingCommand(true);
    try {
      const res = await fetch(`${API_BASE_URL}/devices/commands/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, payload })
      });
      if (!res.ok) throw new Error(await res.text());
    } finally {
      setSendingCommand(false);
    }
  };

  const sendToDevice = async (deviceId: string, type: string, payload: Record<string, unknown> = {}) => {
    setSendingCommand(true);
    try {
      await socketService.sendCommand(deviceId, type, payload);
    } finally {
      setSendingCommand(false);
    }
  };

  const handleSendAlert = async () => {
    const message = alertPresetIndex === ALERT_PRESETS.length - 1 ? alertCustomMessage.trim() : ALERT_PRESETS[alertPresetIndex].message;
    if (!message) return;
    if (globalTarget === 'all') {
      await broadcastCommand('ALERT', { message });
    } else {
      await sendToDevice(globalTarget, 'ALERT', { message });
    }
  };

  const handleOpenUrlGlobal = async () => {
    const url = globalUrl.trim();
    if (!url) return;
    if (globalTarget === 'all') {
      await broadcastCommand('OPEN_URL', { url });
    } else {
      await sendToDevice(globalTarget, 'OPEN_URL', { url });
    }
  };

  const handleOpenAppGlobal = async () => {
    const packageName = resolvedGlobalPackage;
    if (!packageName) return;
    if (globalTarget === 'all') {
      await broadcastCommand('LAUNCH_APP', { packageName });
    } else {
      await sendToDevice(globalTarget, 'LAUNCH_APP', { packageName });
    }
  };

  const handleLockAll = async () => {
    await broadcastCommand('LOCK_SCREEN', {});
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setApiError(false);
      try {
        const apiDevices = await deviceService.getDevices();
        setDevices(apiDevices);
      } catch {
        setDevices([]);
        setApiError(true);
      } finally {
        setLoading(false);
      }
    };
    load();

    const unsubscribeSocket = socketService.onDeviceUpdate((updatedDevice: unknown) => {
      const payload = updatedDevice as Record<string, unknown>;
      const id = (payload?.id ?? payload?.deviceId) as string | undefined;
      if (!id) return;
      setDevices(prev => {
        const index = prev.findIndex(d => d.id === id);
        const next = { ...payload, id } as Device;
        if (index > -1) {
          const newDevices = [...prev];
          newDevices[index] = { ...prev[index], ...next };
          return newDevices;
        }
        return [...prev, next];
      });
    });

    return () => {
      unsubscribeSocket();
    };
  }, []);

  useEffect(() => {
    let result = [...devices];

    if (filterStatus !== 'all') {
      result = result.filter(device => device.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(device =>
        device.id.toLowerCase().includes(query) ||
        device.name?.toLowerCase().includes(query) ||
        device.model?.toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'lastSeen') {
        aValue = a.lastSeen || 0;
        bValue = b.lastSeen || 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredDevices(result);
  }, [devices, searchQuery, filterStatus, sortField, sortDirection]);

  const handleSelectDevice = (deviceId: string) => {
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(deviceId)) {
      newSelected.delete(deviceId);
    } else {
      newSelected.add(deviceId);
    }
    setSelectedDevices(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedDevices.size === filteredDevices.length) {
      setSelectedDevices(new Set());
    } else {
      setSelectedDevices(new Set(filteredDevices.map(d => d.id)));
    }
  };

  const handleBulkAction = async (action: string) => {
    const selectedDevicesList = devices.filter(d => selectedDevices.has(d.id));
    const ids = selectedDevicesList.map(d => d.id);
    switch (action) {
      case 'lock':
        await deviceService.sendCommandToAll(ids, 'LOCK_SCREEN', {});
        break;
      case 'reboot':
        await deviceService.sendCommandToAll(ids, 'REBOOT', {});
        break;
    }
    setSelectedDevices(new Set());
  };

  const getStatusColor = (status: Device['status']) => {
    switch (status) {
      case 'online': return theme.colors.success[500];
      case 'offline': return theme.colors.neutral[500];
      case 'locked': return theme.colors.danger[500];
      default: return theme.colors.neutral[500];
    }
  };

  const getStatusLabel = (status: Device['status']) => {
    switch (status) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      case 'locked': return 'Bloqueado';
      default: return 'Desconhecido';
    }
  };

  const formatLastSeen = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return new Date(timestamp).toLocaleDateString();
  };


  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[6] }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
        <div>
          <h1 style={{
            fontSize: theme.typography.fontSize['3xl'],
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.primary,
            marginBottom: theme.spacing[2]
          }}>
            Dispositivos
          </h1>
          <p style={{ color: theme.colors.text.secondary }}>
            Gerencie e monitore os tablets da escola em tempo real.
          </p>
        </div>
        <div style={{ display: 'flex', gap: theme.spacing[3] }}>
          <div style={{
            padding: `${theme.spacing[3]} ${theme.spacing[5]} `,
            backgroundColor: theme.colors.background.elevated,
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.border.subtle} `,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: theme.typography.fontSize['2xl'], fontWeight: 'bold', color: theme.colors.primary[500] }}>
              {devices.filter(d => d.status === 'online').length}
            </div>
            <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary }}>Online</div>
          </div>
          <div style={{
            padding: `${theme.spacing[3]} ${theme.spacing[5]} `,
            backgroundColor: theme.colors.background.elevated,
            borderRadius: theme.borderRadius.lg,
            border: `1px solid ${theme.colors.border.subtle} `,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: theme.typography.fontSize['2xl'], fontWeight: 'bold', color: theme.colors.text.primary }}>
              {devices.length}
            </div>
            <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary }}>Total</div>
          </div>
        </div>
      </div>

      <Card style={{ padding: theme.spacing[6] }}>
        <div style={{ marginBottom: theme.spacing[5] }}>
          <h3 style={{ fontSize: theme.typography.fontSize.xl, fontWeight: 600, color: theme.colors.text.primary, marginBottom: theme.spacing[1] }}>
            Comandos globais e notificações
          </h3>
          <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary }}>
            Envie alertas, abra URL ou app em todos os dispositivos ou em um só.
          </p>
        </div>

        <div style={{
          padding: theme.spacing[4],
          backgroundColor: theme.colors.background.secondary,
          borderRadius: theme.borderRadius.lg,
          border: `1px solid ${theme.colors.border.subtle}`,
          marginBottom: theme.spacing[5]
        }}>
          <label style={{ display: 'block', marginBottom: theme.spacing[2], fontWeight: 600, fontSize: theme.typography.fontSize.sm, color: theme.colors.text.primary }}>
            Enviar para
          </label>
          <select
            value={globalTarget}
            onChange={(e) => setGlobalTarget(e.target.value)}
            style={{
              width: '100%',
              maxWidth: 320,
              padding: theme.spacing[3],
              paddingRight: 40,
              minHeight: 40,
              borderRadius: theme.borderRadius.base,
              border: `1px solid ${theme.colors.border.default}`,
              backgroundColor: theme.colors.background.tertiary,
              color: theme.colors.text.primary,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: 500
            }}
          >
            <option value="all">Todos os dispositivos</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>{d.name || d.id}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: theme.spacing[5] }}>
          <div style={{
            padding: theme.spacing[4],
            border: `1px solid ${theme.colors.border.subtle}`,
            borderRadius: theme.borderRadius.lg,
            backgroundColor: theme.colors.background.primary
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[3] }}>
              <MessageSquare size={20} style={{ color: theme.colors.primary[500] }} />
              <span style={{ fontWeight: 600, fontSize: theme.typography.fontSize.sm, color: theme.colors.text.primary }}>Alerta / notificação</span>
            </div>
            <select
              value={alertPresetIndex}
              onChange={(e) => setAlertPresetIndex(Number(e.target.value))}
              style={{
                width: '100%',
                marginBottom: theme.spacing[2],
                padding: theme.spacing[2],
                paddingRight: 40,
                minHeight: 40,
                borderRadius: theme.borderRadius.base,
                border: `1px solid ${theme.colors.border.default}`,
                backgroundColor: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: 500
              }}
            >
              {ALERT_PRESETS.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
            {alertPresetIndex === ALERT_PRESETS.length - 1 && (
              <Input
                placeholder="Digite sua mensagem..."
                value={alertCustomMessage}
                onChange={(e) => setAlertCustomMessage(e.target.value)}
                fullWidth
                style={{ marginBottom: theme.spacing[2] }}
              />
            )}
            <Button onClick={handleSendAlert} disabled={sendingCommand || (alertPresetIndex === ALERT_PRESETS.length - 1 && !alertCustomMessage.trim())} size="sm" style={{ width: '100%' }}>
              Enviar alerta
            </Button>
          </div>

          <div style={{
            padding: theme.spacing[4],
            border: `1px solid ${theme.colors.border.subtle}`,
            borderRadius: theme.borderRadius.lg,
            backgroundColor: theme.colors.background.primary
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[3] }}>
              <Globe size={20} style={{ color: theme.colors.primary[500] }} />
              <span style={{ fontWeight: 600, fontSize: theme.typography.fontSize.sm, color: theme.colors.text.primary }}>Abrir URL</span>
            </div>
            <Input
              placeholder="https://..."
              value={globalUrl}
              onChange={(e) => setGlobalUrl(e.target.value)}
              fullWidth
              style={{ marginBottom: theme.spacing[2] }}
            />
            <Button onClick={handleOpenUrlGlobal} disabled={sendingCommand || !globalUrl.trim()} size="sm" style={{ width: '100%' }}>Abrir</Button>
          </div>

          <div style={{
            padding: theme.spacing[4],
            border: `1px solid ${theme.colors.border.subtle}`,
            borderRadius: theme.borderRadius.lg,
            backgroundColor: theme.colors.background.primary
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[3] }}>
              <AppWindow size={20} style={{ color: theme.colors.primary[500] }} />
              <span style={{ fontWeight: 600, fontSize: theme.typography.fontSize.sm, color: theme.colors.text.primary }}>Abrir app</span>
            </div>
            <select
              value={globalAppPresetIndex}
              onChange={(e) => setGlobalAppPresetIndex(Number(e.target.value))}
              style={{
                width: '100%',
                marginBottom: theme.spacing[2],
                padding: theme.spacing[2],
                paddingRight: 40,
                minHeight: 40,
                borderRadius: theme.borderRadius.base,
                border: `1px solid ${theme.colors.border.default}`,
                backgroundColor: theme.colors.background.tertiary,
                color: theme.colors.text.primary,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: 500
              }}
            >
              {APP_PRESETS.map((p, i) => (
                <option key={i} value={i}>{p.label}</option>
              ))}
            </select>
            {globalAppPresetIndex === APP_PRESETS.length - 1 && (
              <Input
                placeholder="com.exemplo.app"
                value={globalPackageCustom}
                onChange={(e) => setGlobalPackageCustom(e.target.value)}
                fullWidth
                style={{ marginBottom: theme.spacing[2] }}
              />
            )}
            <Button onClick={handleOpenAppGlobal} disabled={sendingCommand || !resolvedGlobalPackage} size="sm" style={{ width: '100%' }}>Abrir app</Button>
          </div>

          <div style={{
            padding: theme.spacing[4],
            border: `1px solid ${theme.colors.border.subtle}`,
            borderRadius: theme.borderRadius.lg,
            backgroundColor: theme.colors.background.primary,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginBottom: theme.spacing[3] }}>
              <Lock size={20} style={{ color: theme.colors.danger[500] }} />
              <span style={{ fontWeight: 600, fontSize: theme.typography.fontSize.sm, color: theme.colors.text.primary }}>Bloquear tela</span>
            </div>
            <p style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary, marginBottom: theme.spacing[3] }}>
              Bloqueia a tela em todos os dispositivos selecionados acima.
            </p>
            <Button variant="danger" size="sm" onClick={handleLockAll} disabled={sendingCommand} style={{ width: '100%' }}>
              <Lock size={16} style={{ marginRight: 6 }} /> Bloquear em todos
            </Button>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', gap: theme.spacing[4], flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: '300px', maxWidth: '500px' }}>
          <Input
            placeholder="Buscar por nome, ID ou modelo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search size={18} />}
            fullWidth
          />
        </div>

        <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
          {(['all', 'online', 'offline', 'locked'] as const).map((status) => {
            const label = status === 'all' ? 'Todos' : status === 'locked' ? 'Bloqueado' : status === 'online' ? 'Online' : 'Offline';
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                style={{
                  padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                  backgroundColor: filterStatus === status ? theme.colors.primary[500] : theme.colors.background.elevated,
                  color: filterStatus === status ? '#fff' : theme.colors.text.secondary,
                  border: `1px solid ${filterStatus === status ? theme.colors.primary[500] : theme.colors.border.default}`,
                  borderRadius: theme.borderRadius.full,
                  cursor: 'pointer',
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  transition: 'all 0.2s ease'
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDevices.size > 0 && (
        <div style={{
          padding: theme.spacing[4],
          backgroundColor: `${theme.colors.primary[500]} 10`,
          border: `1px solid ${theme.colors.primary[500]} 40`,
          borderRadius: theme.borderRadius.base,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }} className="animate-fade-in">
          <span style={{ fontWeight: theme.typography.fontWeight.medium, color: theme.colors.primary[500] }}>
            {selectedDevices.size} dispositivos selecionados
          </span>
          <div style={{ display: 'flex', gap: theme.spacing[2] }}>
            <Button variant="danger" size="sm" onClick={() => handleBulkAction('lock')}>
              <Lock size={16} style={{ marginRight: 8 }} /> Bloquear
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleBulkAction('reboot')}>
              <Power size={16} style={{ marginRight: 8 }} /> Reiniciar
            </Button>
          </div>
        </div>
      )}

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0' }}>
            <thead>
              <tr style={{ backgroundColor: theme.colors.background.tertiary }}>
                <th style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.default} `, width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedDevices.size === filteredDevices.length && filteredDevices.length > 0}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer', accentColor: theme.colors.primary[500], width: 16, height: 16 }}
                  />
                </th>
                <th style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.default} `, textAlign: 'left', fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dispositivo
                </th>
                <th style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.default} `, textAlign: 'left', fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status
                </th>
                <th style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.default} `, textAlign: 'left', fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Atividade Atual
                </th>
                <th style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.default} `, textAlign: 'left', fontSize: theme.typography.fontSize.xs, color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Visto por último
                </th>
                <th style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.default} `, textAlign: 'right', width: '100px' }}>

                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: theme.spacing[8], textAlign: 'center', color: theme.colors.text.secondary }}>
                    Carregando dispositivos...
                  </td>
                </tr>
              ) : apiError ? (
                <tr>
                  <td colSpan={6} style={{ padding: theme.spacing[8], textAlign: 'center' }}>
                    <div style={{ color: theme.colors.danger[500], marginBottom: theme.spacing[3] }}>
                      Backend indisponível. Na raiz do projeto execute: <code style={{ background: theme.colors.background.secondary, padding: '2px 6px', borderRadius: 4 }}>npm run dev</code> (backend na porta 3005).
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setApiError(false);
                        deviceService.getDevices().then(setDevices).catch(() => setApiError(true)).finally(() => setLoading(false));
                        setLoading(true);
                      }}
                      style={{
                        padding: `${theme.spacing[2]} ${theme.spacing[4]}`,
                        borderRadius: theme.borderRadius.md,
                        background: theme.colors.primary[500],
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Tentar novamente
                    </button>
                  </td>
                </tr>
              ) : filteredDevices.length > 0 ? (
                filteredDevices.map((device) => (
                  <tr key={device.id} style={{
                    transition: 'background-color 0.2s',
                    backgroundColor: selectedDevices.has(device.id) ? `${theme.colors.primary[500]}08` : 'transparent'
                  }}>
                    <td style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.muted} ` }}>
                      <input
                        type="checkbox"
                        checked={selectedDevices.has(device.id)}
                        onChange={() => handleSelectDevice(device.id)}
                        style={{ cursor: 'pointer', accentColor: theme.colors.primary[500], width: 16, height: 16 }}
                      />
                    </td>
                    <td style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.muted} ` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[3] }}>
                        <div style={{
                          width: 40, height: 40,
                          borderRadius: theme.borderRadius.base,
                          backgroundColor: theme.colors.background.tertiary,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: theme.colors.text.secondary
                        }}>
                          <Smartphone size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: theme.typography.fontWeight.medium, color: theme.colors.text.primary }}>
                            {device.name || device.id}
                          </div>
                          <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.tertiary }}>
                            {device.model || 'Unknown Model'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.muted} ` }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, backgroundColor: `${getStatusColor(device.status || 'offline')}15`, color: getStatusColor(device.status || 'offline'), fontSize: theme.typography.fontSize.xs, fontWeight: 600 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: getStatusColor(device.status || 'offline') }} />
                        {getStatusLabel(device.status || 'offline')}
                      </div>
                    </td>
                    <td style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.muted} ` }}>
                      {device.currentUrl ? (
                        <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: theme.colors.primary[400], textDecoration: 'underline' }}>
                          {device.currentUrl}
                        </div>
                      ) : (
                        <span style={{ color: theme.colors.text.tertiary }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.muted} `, color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}>
                      {formatLastSeen(Number(device.lastSeen) || 0)}
                    </td>
                    <td style={{ padding: theme.spacing[4], borderBottom: `1px solid ${theme.colors.border.muted} `, textAlign: 'right' }}>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/devices/${device.id}`)}>
                        Gerenciar
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: theme.spacing[12], textAlign: 'center', color: theme.colors.text.tertiary }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: theme.spacing[4] }}>
                      <CloudOff size={48} style={{ opacity: 0.5 }} />
                      <p>Nenhum dispositivo encontrado.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
