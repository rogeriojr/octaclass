import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Device } from '../services/device.service';
import { socketService } from '../services/socket.service';
import { theme } from '../styles/theme';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { API_BASE_URL, getScreenshotUrl } from '../config/api';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Lock,
  Unlock,
  Camera,
  RefreshCw,
  Globe,
  Smartphone,
  Clock,
  Sun,
  Volume2,
  Calculator,
  AppWindow,
  X,
  Youtube,
  Mail,
  FileText,
  MapPin,
  StickyNote,
  CheckCircle2,
  Ban,
  Calendar,
  MessageCircle,
  Phone,
  Image,
  Music,
  Video,
  Search,
  FolderOpen,
  ShoppingBag,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';

interface ScreenshotItem {
  id: string;
  deviceId: string;
  timestamp: string;
  event: string;
  url?: string | null;
  title?: string | null;
  dataUrl?: string | null;
}

export const DeviceDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'screenshots' | 'timeline'>('info');
  const [zoomShot, setZoomShot] = useState<ScreenshotItem | null>(null);
  const [brightnessLevel, setBrightnessLevel] = useState(80);
  const [volumeLevel, setVolumeLevel] = useState(80);
  const [connectionError, setConnectionError] = useState(false);
  const [policyMessage, setPolicyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openAppPackage, setOpenAppPackage] = useState('');
  const [openAppSent, setOpenAppSent] = useState(false);
  const [openAppError, setOpenAppError] = useState<string | null>(null);
  const [openAppSectionExpanded, setOpenAppSectionExpanded] = useState(false);
  const [blockedPresetIndex, setBlockedPresetIndex] = useState(0);
  const [blockedAppPackage, setBlockedAppPackage] = useState('');
  const [unlockPinInput, setUnlockPinInput] = useState('');

  const fetchDevice = useCallback(async (deviceId: string) => {
    setConnectionError(false);
    try {
      const response = await fetch(`${API_BASE_URL}/devices/${deviceId}`);
      if (response.ok) {
        const apiDevice = await response.json();
        setDevice(apiDevice);
      } else {
        setDevice(null);
        if (response.status === 502 || response.status === 503) {
          setConnectionError(true);
        }
      }
    } catch {
      setDevice(null);
      setConnectionError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchScreenshots = useCallback(async (deviceId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/screenshots/history/${deviceId}?inline=1&limit=30`);
      if (response.ok) {
        const data = await response.json();
        setScreenshots(data);
      }
    } catch {
      setScreenshots([]);
    }
  }, []);

  const clearConnectionError = useCallback(() => {
    setConnectionError(false);
  }, []);

  const fetchTimeline = useCallback(async (deviceId: string) => {
    try {
      const [auditRes, activityRes] = await Promise.all([
        fetch(`${API_BASE_URL}/devices/${deviceId}/audit`).catch(() => null),
        fetch(`${API_BASE_URL}/devices/${deviceId}/activity?limit=80`).catch(() => null)
      ]);
      const audit: any[] = auditRes?.ok ? await auditRes.json() : [];
      const activity: any[] = activityRes?.ok ? await activityRes.json() : [];
      const auditEntries = audit.map((a) => ({
        timestamp: a.timestamp,
        action: a.action,
        source: 'painel',
        user: a.user?.name ?? a.userId ?? 'Sistema',
        details: a.details
      }));
      const activityEntries = activity.map((a) => ({
        timestamp: a.timestamp,
        action: a.action,
        source: a.action === 'COMMAND_SENT' ? 'painel' : 'dispositivo',
        details: a.details
      }));
      const merged = [...auditEntries, ...activityEntries].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setTimeline(merged);
    } catch {
      setTimeline([]);
    }
  }, []);

  useEffect(() => {
    if (!id) return;

    fetchDevice(id);
    const unsubscribeDevice = socketService.onDeviceUpdate((updatedDevice: unknown) => {
      const payload = updatedDevice as Record<string, unknown>;
      const deviceId = (payload?.id ?? payload?.deviceId) as string | undefined;
      if (deviceId === id) {
        setDevice(prev => (prev ? ({ ...prev, ...payload, id: deviceId }) : { ...payload, id: deviceId }) as Device);
        setLoading(false);
      }
    });

    fetchScreenshots(id);
    const screenshotInterval = setInterval(() => fetchScreenshots(id), 30000);

    fetchTimeline(id);
    const timelineInterval = setInterval(() => fetchTimeline(id!), 30000);

    return () => {
      unsubscribeDevice();
      clearInterval(screenshotInterval);
      clearInterval(timelineInterval);
    };
  }, [id, fetchDevice, fetchScreenshots, fetchTimeline]);

  const handleSendCommand = async (type: string, payload: Record<string, unknown> = {}) => {
    if (!device) return;
    await socketService.sendCommand(device.id, type, payload);
    if (type === 'GET_PRINT' && id) {
      setTimeout(() => fetchScreenshots(id), 2000);
      setTimeout(() => fetchScreenshots(id), 5000);
    }
  };

  const handleOpenUrl = () => {
    if (newUrl) {
      handleSendCommand('OPEN_URL', { url: newUrl });
      setNewUrl('');
    }
  };

  const handleSetBrightness = () => {
    handleSendCommand('SET_BRIGHTNESS', { level: brightnessLevel / 100 });
  };

  const handleSetVolume = () => {
    handleSendCommand('VOLUME', { level: volumeLevel / 100 });
  };

  const handleLiberarHome = async () => {
    if (!device?.id) return;
    await updateDevicePolicy({ kioskMode: false });
    await handleSendCommand('STOP_KIOSK', {});
  };

  const handleAtivarKiosk = async () => {
    await updateDevicePolicy({ kioskMode: true });
  };

  const updateDevicePolicy = async (updates: { allowedApps?: string[]; blockedApps?: string[]; kioskMode?: boolean; unlockPin?: string | null }) => {
    if (!device?.id) return false;
    setPolicyMessage(null);
    try {
      const policies = device.policies as { allowedApps?: string[]; blockedApps?: string[]; kioskMode?: boolean; hasUnlockPin?: boolean } | undefined;
      const allowedApps = updates.allowedApps ?? policies?.allowedApps ?? [];
      const blockedApps = updates.blockedApps ?? policies?.blockedApps ?? [];
      const kioskMode = updates.kioskMode !== undefined ? updates.kioskMode : (policies?.kioskMode ?? true);
      const body: Record<string, unknown> = {
        allowedApps,
        blockedApps,
        blockedDomains: device.policies?.blockedDomains ?? [],
        screenshotInterval: device.policies?.screenshotInterval ?? 60000,
        kioskMode
      };
      if (updates.unlockPin !== undefined) body.unlockPin = updates.unlockPin;
      const res = await fetch(`${API_BASE_URL}/devices/${device.id}/policies`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = res.ok ? await res.json().catch(() => ({})) : await res.json().catch(() => ({}));
      if (!res.ok) {
        setPolicyMessage({ type: 'error', text: (data as { error?: string })?.error ?? 'Falha ao salvar políticas' });
        return false;
      }
      setPolicyMessage({ type: 'success', text: 'Políticas salvas. O dispositivo será atualizado em instantes.' });
      setTimeout(() => setPolicyMessage(null), 4000);
      const hasUnlockPin = updates.unlockPin !== undefined ? (updates.unlockPin !== null && updates.unlockPin !== '') : policies?.hasUnlockPin;
      setDevice(prev => prev?.policies ? { ...prev, policies: { ...prev.policies, kioskMode, hasUnlockPin } } : prev);
      await fetchDevice(device.id);
      return true;
    } catch {
      setPolicyMessage({ type: 'error', text: 'Erro de conexão ao salvar políticas' });
      return false;
    }
  };

  const getBlockedPackageFromPreset = (index: number, custom: string) =>
    index === APP_PRESETS.length ? custom.trim() : (APP_PRESETS[index]?.package ?? '');

  const handleBlockApp = async (pkg: string) => {
    if (!pkg.trim() || !device?.policies) return;
    const policies = device.policies as { blockedApps?: string[]; allowedApps?: string[] };
    const current = policies.blockedApps ?? [];
    const normalized = pkg.trim();
    if (current.includes(normalized)) return;
    const next = [...current, normalized];
    const ok = await updateDevicePolicy({ blockedApps: next });
    if (ok) {
      setBlockedAppPackage('');
      setBlockedPresetIndex(0);
    }
  };

  const handleRemoveBlockedApp = async (pkg: string) => {
    if (!device?.policies) return;
    const policies = device.policies as { blockedApps?: string[] };
    const blockedApps = (policies.blockedApps ?? []).filter((p: string) => p !== pkg);
    await updateDevicePolicy({ blockedApps });
  };

  const handleBlockAllExceptOctaclass = async () => {
    if (!device?.policies) return;
    const blockedApps = APP_PRESETS.map(p => p.package).filter(p => p !== 'com.octoclass.mobile');
    await updateDevicePolicy({ blockedApps });
    setDevice(prev => prev?.policies ? { ...prev, policies: { ...prev.policies, blockedApps } } : prev);
  };

  const APP_PRESETS: { label: string; package: string; Icon: LucideIcon }[] = [
    { label: 'Chrome', package: 'com.android.chrome', Icon: Globe },
    { label: 'YouTube', package: 'com.google.android.youtube', Icon: Youtube },
    { label: 'Play Store', package: 'com.android.vending', Icon: ShoppingBag },
    { label: 'Calculadora', package: 'com.android.calculator2', Icon: Calculator },
    { label: 'Octoclass', package: 'com.octoclass.mobile', Icon: Smartphone },
    { label: 'Keep', package: 'com.google.android.keep', Icon: StickyNote },
    { label: 'Gmail', package: 'com.google.android.gm', Icon: Mail },
    { label: 'Drive', package: 'com.google.android.apps.docs', Icon: FileText },
    { label: 'Maps', package: 'com.google.android.apps.maps', Icon: MapPin },
    { label: 'Google', package: 'com.google.android.googlequicksearchbox', Icon: Search },
    { label: 'Fotos', package: 'com.google.android.apps.photos', Icon: Image },
    { label: 'Contatos', package: 'com.android.contacts', Icon: Smartphone },
    { label: 'Calendário', package: 'com.google.android.calendar', Icon: Calendar },
    { label: 'Relógio', package: 'com.google.android.deskclock', Icon: Clock },
    { label: 'Mensagens', package: 'com.google.android.apps.messaging', Icon: MessageCircle },
    { label: 'Telefone', package: 'com.android.dialer', Icon: Phone },
    { label: 'Arquivos', package: 'com.google.android.apps.nbu.files', Icon: FolderOpen },
    { label: 'YouTube Music', package: 'com.google.android.apps.youtube.music', Icon: Music },
    { label: 'Meet', package: 'com.google.android.apps.tachyon', Icon: Video }
  ];

  const getPresetLabel = (pkg: string) => APP_PRESETS.find(p => p.package === pkg)?.label ?? pkg;

  const QUICK_LAUNCH: { label: string; Icon: LucideIcon; type: 'LAUNCH_CALCULATOR' | 'LAUNCH_CAMERA' | 'LAUNCH_APP'; packageName?: string }[] = [
    { label: 'Calculadora', Icon: Calculator, type: 'LAUNCH_CALCULATOR' },
    { label: 'Câmera', Icon: Camera, type: 'LAUNCH_CAMERA' },
    ...APP_PRESETS.filter(p => p.package !== 'com.android.calculator2').map(p => ({ label: p.label, Icon: p.Icon, type: 'LAUNCH_APP' as const, packageName: p.package }))
  ];

  const handleOpenAppNow = async (item: typeof QUICK_LAUNCH[0]) => {
    setOpenAppError(null);
    try {
      if (item.type === 'LAUNCH_APP' && item.packageName) {
        await socketService.sendCommand(device!.id, 'LAUNCH_APP', { packageName: item.packageName });
      } else {
        await socketService.sendCommand(device!.id, item.type, {});
      }
      setOpenAppSent(true);
      window.setTimeout(() => setOpenAppSent(false), 2200);
    } catch (e) {
      setOpenAppError(e instanceof Error ? e.message : 'Falha ao enviar comando. Verifique se a API está no ar e o dispositivo online.');
      window.setTimeout(() => setOpenAppError(null), 4000);
    }
  };

  if (connectionError) {
    return (
      <div style={{ padding: theme.spacing[8], maxWidth: 480 }}>
        <div
          style={{
            padding: theme.spacing[6],
            borderRadius: theme.borderRadius.lg,
            background: theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border.default}`
          }}
        >
          <h2 style={{ fontSize: theme.typography.fontSize.xl, fontWeight: 700, marginBottom: theme.spacing[3] }}>
            Backend indisponível
          </h2>
          <p style={{ color: theme.colors.text.secondary, marginBottom: theme.spacing[4] }}>
            Não foi possível conectar ao servidor. Inicie o backend e o painel na <strong>raiz do projeto</strong>:
          </p>
          <pre
            style={{
              padding: theme.spacing[3],
              background: theme.colors.background.primary,
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.fontSize.sm,
              overflow: 'auto'
            }}
          >
            cd D:\octaclass{'\n'}npm run dev
          </pre>
          <p style={{ color: theme.colors.text.tertiary, fontSize: theme.typography.fontSize.sm, marginTop: theme.spacing[3] }}>
            O backend deve rodar na porta 3005 e o painel na 3030. Depois recarregue esta página.
          </p>
          <button
            type="button"
            onClick={() => {
              clearConnectionError();
              if (id) fetchDevice(id);
            }}
            style={{
              marginTop: theme.spacing[4],
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
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: theme.spacing[8], color: theme.colors.text.secondary }}>
        Carregando dispositivo...
      </div>
    );
  }

  if (!device) {
    return (
      <div style={{ padding: theme.spacing[8], color: theme.colors.text.secondary }}>
        Dispositivo não encontrado.
      </div>
    );
  }

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing[4],
    marginBottom: theme.spacing[6]
  };

  const gridStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[6],
    maxWidth: 720
  };

  const sectionTitleStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    marginBottom: theme.spacing[4],
    color: theme.colors.text.primary,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing[2]
  };

  const infoRowStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing[3],
    borderBottom: `1px solid ${theme.colors.border.subtle}`
  };

  const labelStyles: React.CSSProperties = {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm
  };

  const valueStyles: React.CSSProperties = {
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeight.medium,
    fontSize: theme.typography.fontSize.sm
  };

  const lastSeenDisplay = typeof device.lastSeen === 'number'
    ? new Date(device.lastSeen).toLocaleString()
    : new Date(device.lastSeen).toLocaleString();

  return (
    <div className="animate-fade-in">
      <div style={headerStyles}>
        <Button variant="ghost" onClick={() => navigate('/devices')}>
          <ArrowLeft size={20} />
        </Button>
        <div>
          <h1 style={{ fontSize: theme.typography.fontSize['2xl'], fontWeight: theme.typography.fontWeight.bold, margin: 0 }}>
            {device.name || device.id}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2], marginTop: theme.spacing[1] }}>
            <span style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: device.status === 'online' ? theme.colors.success[500] : theme.colors.neutral[500]
            }} />
            <span style={{ color: theme.colors.text.secondary, fontSize: theme.typography.fontSize.sm }}>
              {device.status === 'online' ? 'Online' : 'Offline'} • Última atividade: {lastSeenDisplay}
            </span>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: theme.spacing[4],
        marginBottom: theme.spacing[6],
        borderBottom: `1px solid ${theme.colors.border.subtle}`
      }}>
        {(['info', 'screenshots', 'timeline'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              paddingBottom: theme.spacing[3],
              color: activeTab === tab ? theme.colors.primary[500] : theme.colors.text.secondary,
              borderBottomWidth: activeTab === tab ? 2 : 0,
              borderBottomStyle: 'solid',
              borderBottomColor: activeTab === tab ? theme.colors.primary[500] : 'transparent',
              borderTopWidth: 0,
              borderLeftWidth: 0,
              borderRightWidth: 0,
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              textTransform: 'capitalize'
            }}
          >
            {tab === 'info' ? 'Informações' : tab === 'screenshots' ? 'Capturas' : 'Linha do Tempo'}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div style={gridStyles}>
          <Card>
            <h3 style={sectionTitleStyles}>
              <Smartphone size={20} /> Informações do Dispositivo
            </h3>
            <div style={infoRowStyles}>
              <span style={labelStyles}>ID</span>
              <span style={valueStyles}>{device.id}</span>
            </div>
            <div style={infoRowStyles}>
              <span style={labelStyles}>Modelo</span>
              <span style={valueStyles}>{device.model ?? 'N/A'}</span>
            </div>
            <div style={infoRowStyles}>
              <span style={labelStyles}>Sistema OS</span>
              <span style={valueStyles}>{device.osVersion ?? 'N/A'}</span>
            </div>
            <div style={infoRowStyles}>
              <span style={labelStyles}>URL atual</span>
              <span style={{ ...valueStyles, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }} title={device.currentUrl ?? undefined}>
                {device.currentUrl ? (
                  <a href={device.currentUrl} target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.primary[500] }}>
                    {device.currentUrl}
                  </a>
                ) : loading ? (
                  '...'
                ) : (
                  'Nenhuma'
                )}
              </span>
            </div>
          </Card>

          <Card>
            <h3 style={sectionTitleStyles}>
              <Lock size={20} /> Tela e dispositivo
            </h3>
            <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing[4] }}>
              Bloquear ou desbloquear a tela, capturar imagem da tela ou reiniciar via MDM.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing[3] }}>
              <Button onClick={() => handleSendCommand('LOCK_SCREEN', {})} variant="danger">
                <Lock size={16} /> Bloquear tela
              </Button>
              <Button onClick={() => handleSendCommand('LOCK_SCREEN', { requirePin: true })} variant="danger" title="Bloqueia e exige o PIN de desbloqueio definido abaixo.">
                <Lock size={16} /> Bloquear com PIN
              </Button>
              <Button onClick={() => handleSendCommand('UNLOCK_SCREEN', {})} variant="success" title="Atualiza o estado no app; o dispositivo deve ser desbloqueado manualmente pelo utilizador.">
                <Unlock size={16} /> Desbloquear
              </Button>
              <Button onClick={() => handleSendCommand('GET_PRINT', {})} variant="secondary">
                <Camera size={16} /> Capturar tela
              </Button>
              <Button onClick={() => handleSendCommand('REBOOT', {})} variant="secondary">
                <RefreshCw size={16} /> Reiniciar
              </Button>
            </div>
            <p style={{ fontSize: 12, color: theme.colors.text.tertiary, marginTop: theme.spacing[2] }}>
              Desbloquear remove o overlay de PIN (se ativo) e atualiza o estado no app. O desbloqueio do aparelho (tela do sistema) é feito manualmente pelo usuário no dispositivo.
            </p>
            <div style={{ marginTop: theme.spacing[4], paddingTop: theme.spacing[4], borderTop: `1px solid ${theme.colors.border.subtle}` }}>
              <h4 style={{ ...labelStyles, marginBottom: theme.spacing[2], fontWeight: 600 }}>Modo Kiosk e acesso à Home</h4>
              <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing[3] }}>
                Com modo kiosk ativo, o dispositivo fica preso ao app Octaclass e não acessa a Home. Use o botão abaixo para liberar a Home quando precisar.
              </p>
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap' }}>
                <Button onClick={handleLiberarHome} variant="success" title="Libera o acesso à Home e sai do lock task">
                  <Unlock size={16} /> Liberar Home (sair do kiosk)
                </Button>
                <Button onClick={handleAtivarKiosk} variant="secondary" title="Ativa o modo kiosk; o dispositivo aplica na próxima sincronização">
                  <Lock size={16} /> Ativar modo kiosk
                </Button>
              </div>
              <p style={{ fontSize: 12, color: theme.colors.text.tertiary, marginTop: theme.spacing[2] }}>
                Estado atual: {(device.policies?.kioskMode !== false) ? 'Kiosk ativo (Home bloqueada)' : 'Home liberada'}
              </p>
            </div>
            <div style={{ marginTop: theme.spacing[4], paddingTop: theme.spacing[4], borderTop: `1px solid ${theme.colors.border.subtle}` }}>
              <h4 style={{ ...labelStyles, marginBottom: theme.spacing[2], fontWeight: 600 }}>Bloqueio com senha</h4>
              <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing[3] }}>
                Define o PIN que o aluno digita no dispositivo para desbloquear quando você usar &quot;Bloquear com PIN&quot;. Deixe vazio para remover o PIN.
              </p>
              <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={unlockPinInput}
                  onChange={(e) => setUnlockPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="PIN (máx. 8 dígitos; vazio = sem PIN)"
                  style={{
                    padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                    borderRadius: theme.borderRadius.md,
                    border: `1px solid ${theme.colors.border.default}`,
                    backgroundColor: theme.colors.background.secondary,
                    color: theme.colors.text.primary,
                    minWidth: 220,
                    fontSize: theme.typography.fontSize.sm
                  }}
                  aria-label="PIN de desbloqueio"
                />
                <Button
                  size="sm"
                  onClick={async () => {
                    const value = unlockPinInput.trim();
                    const ok = await updateDevicePolicy({ unlockPin: value || null });
                    if (ok) setUnlockPinInput('');
                  }}
                >
                  Salvar PIN
                </Button>
              </div>
              <p style={{ fontSize: 12, color: theme.colors.text.tertiary, marginTop: theme.spacing[2] }}>
                {device.policies?.hasUnlockPin ? 'PIN configurado para este dispositivo.' : 'Nenhum PIN configurado.'}
              </p>
            </div>
          </Card>

          <Card>
            <h3 style={sectionTitleStyles}>
              <Sun size={20} /> Brilho e volume
            </h3>
              <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing[3] }}>
                Brilho altera a tela do tablet. Volume requer o app nativo (Kiosk) no dispositivo para funcionar.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[3] }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
                  <Sun size={18} style={{ color: theme.colors.text.secondary }} />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={brightnessLevel}
                    onChange={(e) => setBrightnessLevel(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={valueStyles}>{brightnessLevel}%</span>
                  <Button size="sm" onClick={handleSetBrightness}>Aplicar brilho</Button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
                  <Volume2 size={18} style={{ color: theme.colors.text.secondary }} />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volumeLevel}
                    onChange={(e) => setVolumeLevel(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={valueStyles}>{volumeLevel}%</span>
                  <Button size="sm" onClick={handleSetVolume}>Aplicar volume</Button>
                </div>
              </div>
            </Card>

            <Card>
              <button
                type="button"
                onClick={() => setOpenAppSectionExpanded(prev => !prev)}
                aria-expanded={openAppSectionExpanded}
                aria-controls="open-app-section"
                aria-label={openAppSectionExpanded ? 'Recolher seção Abrir app' : 'Expandir seção Abrir app'}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[2],
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'inherit',
                  font: 'inherit'
                }}
              >
                <h3 style={{ ...sectionTitleStyles, marginBottom: 0 }}>
                  <AppWindow size={20} /> Abrir app agora
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8, fontSize: theme.typography.fontSize.sm, fontWeight: 500, color: theme.colors.warning[600] }} title="Funcionalidade em beta">
                    <AlertTriangle size={18} aria-hidden />
                    Em beta — ainda não funciona 100%
                  </span>
                </h3>
                <ChevronDown
                  size={20}
                  style={{ marginLeft: 'auto', flexShrink: 0, transform: openAppSectionExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  aria-hidden
                />
              </button>
              {openAppSectionExpanded && (
                <div id="open-app-section" role="region" aria-labelledby="open-app-heading">
                  <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing[3], marginTop: theme.spacing[3] }} id="open-app-heading">
                    Clique em um app para abri-lo no dispositivo. Em modo kiosk, o app é adicionado aos permitidos automaticamente.
                  </p>
                  {openAppSent && (
                    <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.success[600], marginBottom: theme.spacing[2], fontWeight: 500 }} role="status">
                      Comando enviado. O app deve abrir no dispositivo em instantes.
                    </p>
                  )}
                  {openAppError && (
                    <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.danger[500], marginBottom: theme.spacing[2], fontWeight: 500 }} role="alert">
                      {openAppError}
                    </p>
                  )}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
                      gap: theme.spacing[2],
                      marginBottom: theme.spacing[4]
                    }}
                  >
                    {QUICK_LAUNCH.map((item) => (
                      <Button
                        key={item.type === 'LAUNCH_APP' ? item.packageName : item.type}
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenAppNow(item)}
                        aria-label={`Abrir ${item.label} no dispositivo`}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36, whiteSpace: 'nowrap' }}
                      >
                        <item.Icon size={16} aria-hidden />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                      </Button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing[2], alignItems: 'center' }}>
                    <Input
                      value={openAppPackage}
                      onChange={(e) => { setOpenAppPackage(e.target.value); setOpenAppError(null); }}
                      placeholder="Pacote (ex: com.android.chrome)"
                      style={{ minWidth: 220, flex: '1 1 200px' }}
                      aria-label="Pacote do app para abrir"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        if (!openAppPackage.trim() || !device) return;
                        setOpenAppError(null);
                        try {
                          await socketService.sendCommand(device.id, 'LAUNCH_APP', { packageName: openAppPackage.trim() });
                          setOpenAppPackage('');
                          setOpenAppSent(true);
                          window.setTimeout(() => setOpenAppSent(false), 2200);
                        } catch (e) {
                          setOpenAppError(e instanceof Error ? e.message : 'Falha ao enviar comando.');
                          window.setTimeout(() => setOpenAppError(null), 4000);
                        }
                      }}
                      disabled={!openAppPackage.trim()}
                      aria-label="Abrir app pelo pacote"
                    >
                      <AppWindow size={16} style={{ marginRight: 6 }} /> Abrir
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card>
              <h3 style={sectionTitleStyles}>
                <Lock size={20} /> Apps ocultos no launcher
              </h3>
              <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing[3] }} id="blocked-apps-heading">
                Apps nesta lista ficam ocultos do launcher. Para um app voltar a aparecer, remova-o da lista. Exige Device Owner.
              </p>
              <div style={{ marginBottom: theme.spacing[3] }}>
                <Button size="sm" variant="danger" onClick={handleBlockAllExceptOctaclass} aria-label="Bloquear todos os apps dos presets exceto Octaclass">
                  <Lock size={16} style={{ marginRight: 6 }} /> Bloquear todos exceto Octaclass
                </Button>
                <p style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.tertiary, marginTop: theme.spacing[2] }}>
                  Oculta no launcher todos os apps dos presets (Chrome, YouTube, Play Store, etc.), exceto o Octaclass. Outros apps instalados podem continuar visíveis; use &quot;Outro&quot; para ocultá-los.
                </p>
              </div>
              {policyMessage && (
                <div
                  role="alert"
                  style={{
                    marginBottom: theme.spacing[3],
                    padding: theme.spacing[3],
                    borderRadius: theme.borderRadius.base,
                    backgroundColor: policyMessage.type === 'success' ? theme.colors.success[50] : theme.colors.danger[50],
                    border: `1px solid ${policyMessage.type === 'success' ? theme.colors.success[200] : theme.colors.danger[200]}`,
                    color: policyMessage.type === 'success' ? theme.colors.success[800] : theme.colors.danger[800],
                    fontSize: theme.typography.fontSize.sm
                  }}
                >
                  {policyMessage.type === 'success' ? <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} /> : null}
                  {policyMessage.type === 'error' ? <Ban size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} /> : null}
                  {policyMessage.text}
                </div>
              )}
              <div style={{ marginBottom: theme.spacing[3] }}>
                <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', alignItems: 'center', marginBottom: theme.spacing[2] }}>
                  {APP_PRESETS.map((p) => {
                    const blocked = ((device.policies as { blockedApps?: string[] })?.blockedApps ?? []).includes(p.package);
                    return (
                      <button
                        key={p.package}
                        type="button"
                        disabled={blocked}
                        onClick={() => handleBlockApp(p.package)}
                        aria-label={blocked ? `${p.label} já oculto` : `Ocultar ${p.label} no launcher`}
                        title={blocked ? 'Já oculto' : `Ocultar ${p.label}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                          borderRadius: theme.borderRadius.base,
                          border: `1px solid ${theme.colors.border.default}`,
                          background: blocked ? theme.colors.background.tertiary : theme.colors.background.secondary,
                          color: theme.colors.text.primary,
                          fontSize: theme.typography.fontSize.sm,
                          fontWeight: 500,
                          cursor: blocked ? 'default' : 'pointer',
                          opacity: blocked ? 0.8 : 1
                        }}
                      >
                        <p.Icon size={18} aria-hidden />
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: theme.spacing[2], flexWrap: 'wrap', alignItems: 'center' }}>
                  <select
                    value={blockedPresetIndex}
                    onChange={(e) => setBlockedPresetIndex(Number(e.target.value))}
                    style={{ minWidth: 140, padding: theme.spacing[2], borderRadius: theme.borderRadius.sm, border: `1px solid ${theme.colors.border.default}`, background: theme.colors.background.secondary, color: theme.colors.text.primary }}
                    aria-label="Escolher app para ocultar"
                  >
                    {APP_PRESETS.map((p, idx) => (
                      <option key={p.package} value={idx}>{p.label}</option>
                    ))}
                    <option value={APP_PRESETS.length}>Outro</option>
                  </select>
                  {blockedPresetIndex === APP_PRESETS.length && (
                    <Input
                      value={blockedAppPackage}
                      onChange={(e) => setBlockedAppPackage(e.target.value)}
                      placeholder="Pacote (ex: com.android.chrome)"
                      style={{ minWidth: 220 }}
                      aria-label="Pacote do app a ocultar"
                    />
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleBlockApp(getBlockedPackageFromPreset(blockedPresetIndex, blockedAppPackage))}
                    disabled={blockedPresetIndex === APP_PRESETS.length && !blockedAppPackage.trim()}
                    aria-label="Ocultar app no launcher"
                  >
                    <Lock size={16} style={{ marginRight: 6 }} /> Ocultar no launcher
                  </Button>
                </div>
              </div>
              <div>
                <strong style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: theme.typography.fontSize.sm, color: theme.colors.danger[600], marginBottom: theme.spacing[2] }}>
                  Ocultos no launcher
                </strong>
                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: theme.spacing[2] }} role="list">
                  {((device.policies as { blockedApps?: string[] })?.blockedApps ?? []).length === 0 ? (
                    <p style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.tertiary }}>Nenhum. Adicione acima para ocultar apps do launcher.</p>
                  ) : (
                    ((device.policies as { blockedApps?: string[] })?.blockedApps ?? []).map((pkg: string) => (
                      <div key={pkg} role="listitem" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing[2], backgroundColor: theme.colors.background.tertiary, borderRadius: theme.borderRadius.sm }}>
                        <span style={{ fontSize: theme.typography.fontSize.sm }}>{getPresetLabel(pkg)}</span>
                        <Button size="sm" variant="ghost" onClick={() => handleRemoveBlockedApp(pkg)} style={{ padding: 4, minWidth: 'auto' }} aria-label={`Mostrar ${getPresetLabel(pkg)} no launcher`}><X size={14} /></Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>

            <Card>
              <h3 style={sectionTitleStyles}>
                <Globe size={20} /> Navegação remota
              </h3>
              <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.text.secondary, marginBottom: theme.spacing[3] }}>
                Envie um link para abrir no navegador do dispositivo.
              </p>
              <div style={{ display: 'flex', gap: theme.spacing[2] }}>
                <Input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  fullWidth
                  icon={<Globe size={16} />}
                />
                <Button onClick={handleOpenUrl}>Abrir</Button>
              </div>
            </Card>
        </div>
      )}

      {activeTab === 'screenshots' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing[4] }}>
            <h3 style={{ ...sectionTitleStyles, marginBottom: 0 }}>
              <Camera size={20} /> Galeria de capturas
            </h3>
            <span style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.text.tertiary }}>
              {screenshots.length} captura(s)
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: theme.spacing[4],
            maxHeight: '600px',
            overflowY: 'auto',
            paddingRight: theme.spacing[2]
          }}>
            {screenshots.length > 0 ? (
              screenshots.map((shot, idx) => (
                <div
                  key={shot.id || idx}
                  role="button"
                  tabIndex={0}
                  onClick={() => setZoomShot(shot)}
                  onKeyDown={(e) => e.key === 'Enter' && setZoomShot(shot)}
                  style={{
                    borderRadius: theme.borderRadius.base,
                    overflow: 'hidden',
                    border: `1px solid ${theme.colors.border.default}`,
                    backgroundColor: theme.colors.background.tertiary,
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                >
                  <img
                    src={shot.dataUrl || getScreenshotUrl(shot.id)}
                    alt={`Captura ${shot.event}`}
                    style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                    loading="lazy"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      if (shot.dataUrl && t) t.src = getScreenshotUrl(shot.id);
                    }}
                  />
                  <div style={{ padding: theme.spacing[2], borderTop: `1px solid ${theme.colors.border.subtle}` }}>
                    <div style={{ fontSize: 10, color: theme.colors.text.secondary, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{new Date(shot.timestamp).toLocaleTimeString()}</span>
                      <span style={{ fontWeight: 600 }}>{shot.event}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: theme.spacing[8], color: theme.colors.text.tertiary }}>
                Nenhuma captura ainda.
              </div>
            )}
          </div>
        </Card>
      )}

      {zoomShot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ampliar captura"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing[4]
          }}
          onClick={() => setZoomShot(null)}
        >
          <button
            type="button"
            onClick={() => setZoomShot(null)}
            style={{
              position: 'absolute',
              top: theme.spacing[4],
              right: theme.spacing[4],
              background: theme.colors.background.tertiary,
              border: 'none',
              borderRadius: theme.borderRadius.full,
              padding: theme.spacing[2],
              cursor: 'pointer',
              color: theme.colors.text.primary
            }}
            aria-label="Fechar"
          >
            <X size={24} />
          </button>
          <img
            src={zoomShot.dataUrl || getScreenshotUrl(zoomShot.id)}
            alt={`Captura ${zoomShot.event}`}
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {activeTab === 'timeline' && (
        <Card>
          <h3 style={sectionTitleStyles}>
            <Clock size={20} /> Histórico de atividades
          </h3>
          <p style={{ fontSize: 14, color: theme.colors.text.secondary, marginBottom: theme.spacing[4] }}>
            Ações do painel (professor) e eventos do dispositivo (aluno).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing[3], maxHeight: '560px', overflowY: 'auto' }}>
            {timeline.length > 0 ? timeline.map((log, idx) => {
              const isDevice = log.source === 'dispositivo';
              const parsedDetails = log.details && (typeof log.details === 'string' ? (() => { try { return JSON.parse(log.details); } catch { return null; } })() : log.details);
              const commandType = parsedDetails?.type;
              const triggerLabels: Record<string, string> = {
                MANUAL: 'manual',
                AUTO_TIMER: 'periódica',
                TAB_CHANGE: 'troca de aba',
                URL_CHANGE: 'troca de URL'
              };
              const deviceActionLabels: Record<string, string> = {
                BLOCKED_SITE: 'Site bloqueado',
                SCREENSHOT_CAPTURED: 'Captura de tela',
                SCREEN_LOCKED: 'Tela bloqueada',
                SCREEN_UNLOCKED: 'Tela desbloqueada',
                URL_OPENED: 'URL aberta',
                BRIGHTNESS_SET: 'Brilho alterado',
                VOLUME_SET: 'Volume alterado',
                APP_LAUNCHED: 'App aberto',
                CAMERA_LAUNCHED: 'Câmera aberta',
                CALCULATOR_LAUNCHED: 'Calculadora aberta',
                COMMAND_RECEIVED: 'Comando recebido no dispositivo'
              };
              const baseLabel = log.action === 'COMMAND_RECEIVED' && commandType
                ? `Comando recebido: ${commandType.replace(/_/g, ' ')}`
                : log.action === 'COMMAND_SENT' && commandType
                  ? `Comando enviado: ${commandType.replace(/_/g, ' ')}`
                  : isDevice && deviceActionLabels[log.action]
                  ? deviceActionLabels[log.action]
                  : isDevice
                    ? log.action.replace(/_/g, ' ').toLowerCase()
                    : log.action;
              const trigger = parsedDetails?.trigger && triggerLabels[parsedDetails.trigger];
              const actionLabel = log.action === 'SCREENSHOT_CAPTURED' && trigger
                ? `${deviceActionLabels.SCREENSHOT_CAPTURED} (${trigger})`
                : baseLabel;
              const detailsUrl = parsedDetails?.url;
              return (
                <div
                  key={`${log.timestamp}-${idx}`}
                  style={{
                    display: 'flex',
                    gap: theme.spacing[4],
                    padding: theme.spacing[3],
                    borderRadius: theme.borderRadius.md,
                    background: isDevice ? theme.colors.background.secondary : 'transparent',
                    borderLeft: `3px solid ${isDevice ? theme.colors.primary[500] : theme.colors.border.default}`
                  }}
                >
                  <div style={{ color: theme.colors.text.tertiary, fontSize: 12, minWidth: 72 }}>
                    {new Date(log.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: theme.colors.text.primary }}>
                      {actionLabel}
                      {detailsUrl && (
                        <span style={{ fontWeight: 400, color: theme.colors.text.tertiary, fontSize: 12, marginLeft: 8 }}>
                          {typeof detailsUrl === 'string' && detailsUrl.length > 40 ? detailsUrl.slice(0, 40) + '…' : detailsUrl}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: theme.colors.text.secondary }}>
                      {isDevice ? 'Dispositivo (aluno)' : (log.user ?? 'Sistema')}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <p style={{ textAlign: 'center', color: theme.colors.text.tertiary }}>Nenhuma atividade registrada.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
