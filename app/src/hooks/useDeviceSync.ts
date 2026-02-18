import { useEffect, useRef, useState } from 'react';
import { Alert, NativeModules, Platform } from 'react-native';
import { Tab } from '../types';
import ViewShot, { captureScreen } from 'react-native-view-shot';
import { DeviceControls } from '../modules/DeviceControls';
import SocketSyncService from '../services/SocketSync';
import * as ExpoDevice from 'expo-device';
import { loadPinLockActive, savePinLockActive } from '../storage/tabsStorage';

const { KioskModule } = NativeModules;

type Policies = {
  blockedDomains: string[];
  allowedApps: string[];
  blockedApps?: string[];
  screenshotInterval: number;
  kioskMode: boolean;
};

export const useDeviceSync = (
  tabs: Tab[],
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  activeTabId: string,
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>,
  viewShotRef: React.RefObject<ViewShot | null>,
  deviceId: string,
  backendApiUrl: string,
  backendSocketUrl: string,
  currentUrl?: string
) => {
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  const currentUrlRef = useRef(currentUrl ?? '');
  currentUrlRef.current = currentUrl ?? '';
  const socketServiceRef = useRef<SocketSyncService | null>(null);
  const brightnessPermissionAlertShownRef = useRef(false);
  const nativeMdmUnavailableAlertShownRef = useRef(false);
  const fetchPoliciesRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const isNativeMdmAvailable = (): boolean =>
    Platform.OS !== 'android' ||
    (typeof (KioskModule as { setBrightness?: unknown })?.setBrightness === 'function' ||
     typeof (KioskModule as { lockScreen?: unknown })?.lockScreen === 'function');

  useEffect(() => {
    tabsRef.current = tabs;
    activeTabIdRef.current = activeTabId;
  }, [tabs, activeTabId]);

  const DEFAULT_BLOCKED = [
    'facebook.com', 'fb.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com',
    'snapchat.com', 'whatsapp.com', 'telegram.org', 'discord.com', 'reddit.com', 'twitch.tv',
    'youtube.com/shorts', 'pinterest.com', 'play.google.com', 'market://'
  ];

  const [policies, setPolicies] = useState<Policies>({
    blockedDomains: DEFAULT_BLOCKED,
    allowedApps: [],
    blockedApps: [],
    screenshotInterval: 60000,
    kioskMode: true
  });

  const [screenLocked, setScreenLocked] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [pinLockActive, setPinLockActive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPinLockActive().then(active => { if (!cancelled) setPinLockActive(active); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!deviceId || !backendApiUrl || !backendSocketUrl) return;

    const logActivity = (action: string, details: Record<string, unknown>) => {
      fetch(`${backendApiUrl}/devices/${deviceId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, details })
      }).catch(() => {});
    };

    const fetchPoliciesFromApi = async () => {
      try {
        const res = await fetch(`${backendApiUrl}/devices/${deviceId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.policies) return;
        const next = {
          blockedDomains: (data.policies.blockedDomains?.length && data.policies.blockedDomains) || DEFAULT_BLOCKED,
          allowedApps: data.policies.allowedApps ?? [],
          blockedApps: data.policies.blockedApps ?? [],
          screenshotInterval: data.policies.screenshotInterval ?? 60000,
          kioskMode: data.policies.kioskMode ?? true
        };
        setPolicies(prev => {
          const same = prev.blockedDomains.length === next.blockedDomains.length
            && prev.blockedDomains.every((d, i) => d === next.blockedDomains[i])
            && prev.screenshotInterval === next.screenshotInterval
            && prev.kioskMode === next.kioskMode
            && prev.allowedApps.length === next.allowedApps.length
            && prev.allowedApps.every((a, i) => a === next.allowedApps[i])
            && (prev.blockedApps?.length ?? 0) === (next.blockedApps?.length ?? 0)
            && (prev.blockedApps ?? []).every((b, i) => (next.blockedApps ?? [])[i] === b);
          return same ? prev : next;
        });
        if (Platform.OS === 'android' && KioskModule) {
          try {
            const blocked = next.blockedApps ?? [];
            const allowed = next.allowedApps ?? [];
            if (KioskModule.setBlockedPackages) {
              KioskModule.setBlockedPackages(blocked);
              logActivity('BLOCKED_APPS_APPLIED', { count: blocked.length });
            }
            if (KioskModule.setAllowedPackages) KioskModule.setAllowedPackages(allowed);
            if (next.kioskMode && typeof (KioskModule as { startKiosk?: () => void }).startKiosk === 'function') {
              (KioskModule as { startKiosk: () => void }).startKiosk();
            } else if (!next.kioskMode && typeof (KioskModule as { stopKiosk?: () => void }).stopKiosk === 'function') {
              (KioskModule as { stopKiosk: () => void }).stopKiosk();
            }
          } catch {
          }
        }
      } catch {
      }
    };

    fetchPoliciesRef.current = fetchPoliciesFromApi;
    fetchPoliciesFromApi();
    const policyInterval = setInterval(fetchPoliciesFromApi, 300000);

    const registerDevice = async () => {
      try {
        await fetch(`${backendApiUrl}/devices/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            name: deviceId,
            model: ExpoDevice.modelName ?? undefined,
            osVersion: Platform.Version?.toString?.() ?? undefined,
            appVersion: '1.0.0'
          })
        });
      } catch {
      }
    };
    registerDevice();

    if (Platform.OS === 'android' && deviceId && backendApiUrl && typeof (KioskModule as { startMdmSyncService?: (a: string, b: string) => void }).startMdmSyncService === 'function') {
      (KioskModule as { startMdmSyncService: (a: string, b: string) => void }).startMdmSyncService(deviceId, backendApiUrl);
    }

    const socketService = new SocketSyncService(deviceId, backendSocketUrl);
    socketServiceRef.current = socketService;
    socketService.setConnectionListener((connected) => {
      setSocketConnected(connected);
      if (connected) fetchPoliciesRef.current?.();
    });

    const showNativeMdmUnavailableOnce = () => {
      if (Platform.OS !== 'android' || nativeMdmUnavailableAlertShownRef.current || isNativeMdmAvailable()) return;
      nativeMdmUnavailableAlertShownRef.current = true;
      Alert.alert(
        'Controles do dispositivo',
        'Brilho, volume, travar tela, calculadora e câmera exigem o build nativo do app. Não use Expo Go.\n\nNo projeto, execute:\nnpx expo run:android\n\nDepois abra o app pelo ícone no dispositivo (não pelo link do Metro).',
        [{ text: 'OK' }]
      );
    };

    const handleCommand = async (command: any) => {
      try {
        logActivity('COMMAND_RECEIVED', { type: command?.type, payload: command?.payload });

        const deviceControlTypes = ['SET_BRIGHTNESS', 'VOLUME', 'LOCK_SCREEN', 'LAUNCH_CALCULATOR', 'LAUNCH_CAMERA', 'LAUNCH_APP'];
        if (deviceControlTypes.includes(command?.type)) showNativeMdmUnavailableOnce();
        if (command.type === 'OPEN_URL') {
          const newTab: Tab = {
            id: Date.now().toString(),
            url: command.payload.url,
            title: 'Nova Aba',
          };
          setTabs(prev => [...prev, newTab]);
          setActiveTabId(newTab.id);
          logActivity('URL_OPENED', { url: command.payload?.url, source: 'panel' });
        }
        else if (command.type === 'CLOSE_TAB') {
          const closeId = command.payload?.tabId === 'active' ? activeTabIdRef.current : command.payload?.tabId;
          const closedTab = tabsRef.current.find(t => t.id === closeId);
          if (closedTab) logActivity('TAB_CLOSED', { tabId: closeId, url: closedTab.url, source: 'panel' });
          setTabs(prev => {
            const next = prev.filter(t => t.id !== closeId);
            if (next.length === 0) {
              const newTab: Tab = { id: Date.now().toString(), url: 'https://www.google.com', title: 'Google' };
              setActiveTabId(newTab.id);
              return [newTab];
            }
            if (closeId === activeTabIdRef.current) {
              setActiveTabId(next[next.length - 1].id);
            }
            return next;
          });
        }
        else if (command.type === 'GET_PRINT') {
          let base64: string | null = null;
          const tab = tabsRef.current.find(t => t.id === activeTabIdRef.current);
          const uploadAndLog = async (imageBase64: string) => {
            await fetch(`${backendApiUrl}/screenshots/upload`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deviceId,
                image: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                timestamp: Date.now(),
                event: 'MANUAL',
                tabId: activeTabIdRef.current,
                url: tab?.url
              })
            });
            await fetch(`${backendApiUrl}/devices/${deviceId}/activity`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'SCREENSHOT_CAPTURED', details: { trigger: 'MANUAL', url: tab?.url } })
            }).catch(() => {});
          };
          const captureOpts = { format: 'jpg' as const, quality: 0.5, result: 'base64' as const };
          try {
            base64 = await captureScreen(captureOpts);
            const normalized = typeof base64 === 'string' && base64.length > 0
              ? (base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`)
              : null;
            if (normalized) {
              await uploadAndLog(normalized.replace(/^data:image\/\w+;base64,/, ''));
            }
          } catch {
          }
        }
        else if (command.type === 'SET_BRIGHTNESS') {
          if (Platform.OS === 'android' && !brightnessPermissionAlertShownRef.current) {
            const canWrite = await DeviceControls.canWriteSystemSettings();
            if (!canWrite) {
              brightnessPermissionAlertShownRef.current = true;
              Alert.alert(
                'Brilho do sistema',
                'Para alterar o brilho do aparelho, ative "Modificar configurações do sistema" em Configurações > Apps > Octaclass. Deseja abrir as configurações agora?',
                [
                  { text: 'Depois' },
                  {
                    text: 'Abrir configurações',
                    onPress: () => DeviceControls.openWriteSettingsOnce()
                  }
                ]
              );
            }
          }
          await DeviceControls.setBrightness(command.payload?.level ?? 0.8);
          logActivity('BRIGHTNESS_SET', { level: command.payload?.level, source: 'panel' });
          logActivity('BRIGHTNESS_APPLIED', { level: command.payload?.level });
          if (Platform.OS === 'android') {
            const { ToastAndroid } = require('react-native');
            ToastAndroid.show('Brilho alterado', ToastAndroid.SHORT);
          }
        }
        else if (command.type === 'VOLUME') {
          DeviceControls.setVolume(command.payload?.level ?? 0.8);
          logActivity('VOLUME_SET', { level: command.payload?.level, source: 'panel' });
          logActivity('VOLUME_APPLIED', { level: command.payload?.level });
        }
        else if (command.type === 'LAUNCH_APP') {
          const pkg = command.payload?.packageName;
          if (!pkg) return;
          const allowed = policies.allowedApps ?? [];
          const hadToAddToAllowed = Platform.OS === 'android' && KioskModule?.setAllowedPackages && policies.kioskMode && !allowed.includes(pkg);
          if (hadToAddToAllowed) {
            try {
              KioskModule.setAllowedPackages([...allowed, pkg]);
            } catch {
            }
          }
          const doLaunch = () => {
            DeviceControls.launchApp(pkg);
            logActivity('APP_LAUNCHED', { packageName: pkg, source: 'panel' });
          };
          if (hadToAddToAllowed) {
            setTimeout(doLaunch, 400);
          } else {
            doLaunch();
          }
        }
        else if (command.type === 'STOP_KIOSK') {
          if (Platform.OS === 'android' && KioskModule?.stopKiosk) {
            try {
              KioskModule.stopKiosk();
            } catch {
            }
          }
          logActivity('KIOSK_STOPPED', { source: 'panel' });
        }
        else if (command.type === 'LOCK_SCREEN') {
          const requirePin = command.payload?.requirePin === true;
          if (requirePin) {
            setPinLockActive(true);
            savePinLockActive(true).catch(() => {});
            try {
              await DeviceControls.lockScreen();
              setScreenLocked(true);
            } catch {
            }
            logActivity('SCREEN_LOCKED', { source: 'panel', requirePin: true });
          } else {
            try {
              await DeviceControls.lockScreen();
              setScreenLocked(true);
              logActivity('SCREEN_LOCKED', { source: 'panel' });
            } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('NOT_DEVICE_OWNER') || msg.includes('Device Owner')) {
              Alert.alert(
                'Bloquear tela',
                'O app precisa ser administrador do dispositivo (Device Owner). Em um dispositivo sem contas, execute: adb shell dpm set-device-owner com.octoclass.mobile/.DeviceAdminReceiver',
                [{ text: 'OK' }]
              );
            } else {
              Alert.alert('Bloquear tela', 'Não foi possível bloquear a tela.', [{ text: 'OK' }]);
            }
          }
        }
        }
        else if (command.type === 'UNLOCK_SCREEN') {
          if (Platform.OS === 'android' && KioskModule?.stopKiosk) {
            try {
              KioskModule.stopKiosk();
            } catch {
            }
          }
          setScreenLocked(false);
          setPinLockActive(false);
          savePinLockActive(false).catch(() => {});
          logActivity('SCREEN_UNLOCKED', { source: 'panel' });
        }
        else if (command.type === 'REBOOT') {
          DeviceControls.reboot();
          logActivity('REBOOT_REQUESTED', { source: 'panel' });
        }
        else if (command.type === 'LAUNCH_CAMERA') {
          DeviceControls.launchCamera();
          logActivity('CAMERA_LAUNCHED', { source: 'panel' });
        }
        else if (command.type === 'LAUNCH_CALCULATOR') {
          DeviceControls.launchCalculator();
          logActivity('CALCULATOR_LAUNCHED', { source: 'panel' });
        }
        else if (command.type === 'APP_STORE_CONTROL') {
          DeviceControls.setAppStoreEnabled(command.payload.enabled);
        }
        else if (command.type === 'ALERT') {
          const message = command.payload?.message ?? '';
          Alert.alert('Mensagem do Professor', String(message), [{ text: 'OK' }]);
        }
        else if (command.type === 'POLICY_CHANGE') {
          const payload = command.payload ?? {};
          setPolicies(prev => ({ ...prev, ...payload }));
          if (Platform.OS === 'android' && KioskModule) {
            try {
              const allowedApps = Array.isArray(payload.allowedApps) ? payload.allowedApps : [];
              const blockedApps = Array.isArray(payload.blockedApps) ? payload.blockedApps : [];
              if (KioskModule.setAllowedPackages) {
                KioskModule.setAllowedPackages(allowedApps);
              }
              if (KioskModule.setBlockedPackages) {
                KioskModule.setBlockedPackages(blockedApps);
                logActivity('BLOCKED_APPS_APPLIED', { count: blockedApps.length });
              }
              if (payload.kioskMode !== false && typeof (KioskModule as { startKiosk?: () => void }).startKiosk === 'function') {
                (KioskModule as { startKiosk: () => void }).startKiosk();
              }
            } catch {
            }
          }
        }

      } catch {
      }
    };

    socketService.connect();
    socketService.listenToCommands(handleCommand);

    const doHeartbeat = () => {
      socketService.sendHeartbeat();
      const url = currentUrlRef.current;
      fetch(`${backendApiUrl}/devices/${deviceId}/heartbeat`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(url ? { currentUrl: url } : {})
      }).catch(() => {});
    };
    doHeartbeat();
    const heartbeatInterval = setInterval(doHeartbeat, 15000);

    return () => {
      socketService.setConnectionListener(null);
      setSocketConnected(false);
      clearInterval(heartbeatInterval);
      clearInterval(policyInterval);
      socketService.disconnect();
    };
  }, [deviceId, backendApiUrl, backendSocketUrl, currentUrl]);

  const updateUrlStatus = (url: string, title: string) => {
    if (!deviceId || !backendApiUrl) return;
    fetch(`${backendApiUrl}/devices/${deviceId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'URL_CHANGED', details: { url, title, source: 'device' } })
    }).catch(() => {});
  };

  const reportBlockedSite = (url: string) => {
    fetch(`${backendApiUrl}/devices/${deviceId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'BLOCKED_SITE', details: { url } })
    }).catch(() => {});
  };

  const hasNativeModule = Platform.OS !== 'android' || !!KioskModule;
  const dismissPinLock = () => {
    setPinLockActive(false);
    savePinLockActive(false).catch(() => {});
  };
  return { updateUrlStatus, reportBlockedSite, policies, screenLocked, socketConnected, hasNativeModule, pinLockActive, dismissPinLock };
};
