import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef, useMemo, Component } from 'react';
import { View, Text, ScrollView, useWindowDimensions, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import styled from 'styled-components/native';
import { Tab } from './src/types';
import { Browser } from './src/components/Browser';
import { useDeviceSync } from './src/hooks/useDeviceSync';
import { useAutoCapture } from './src/hooks/useAutoCapture';
import * as NavigationBar from 'expo-navigation-bar';
import * as Device from 'expo-device';
import ViewShot from 'react-native-view-shot';
import { BACKEND_API_URL, BACKEND_SOCKET_URL } from './src/config/Constants';
import KioskModule from './src/modules/KioskModule';
import { Lock } from 'lucide-react-native';
import { loadTabsState, saveTabsState, loadDeviceId, saveDeviceId } from './src/storage/tabsStorage';

class AppErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <View
          style={{
            flex: 1,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#fef2f2',
            padding: 24,
            zIndex: 99999
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#b91c1c', marginBottom: 8 }}>Erro no app</Text>
          <Text style={{ fontSize: 14, color: '#991b1b', marginBottom: 12 }}>{this.state.error.message}</Text>
          {this.state.error.stack ? (
            <ScrollView style={{ maxHeight: 200 }}>
              <Text style={{ fontSize: 10, color: '#7f1d1d', fontFamily: 'monospace' }} selectable>
                {this.state.error.stack}
              </Text>
            </ScrollView>
          ) : null}
        </View>
      );
    }
    return this.props.children;
  }
}

const LockOverlay = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #0f172a;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  padding: 24px;
`;

const LockTitle = styled.Text`
  font-size: 22px;
  font-weight: 700;
  color: #f8fafc;
  margin-top: 20px;
  text-align: center;
`;

const LockMessage = styled.Text`
  font-size: 16px;
  color: #94a3b8;
  margin-top: 12px;
  text-align: center;
`;

const PinInput = styled.TextInput`
  width: 100%;
  max-width: 240px;
  margin-top: 24px;
  padding: 14px 16px;
  font-size: 18px;
  background-color: #1e293b;
  color: #f8fafc;
  border-radius: 8px;
  letter-spacing: 4px;
  text-align: center;
`;

const PinSubmit = styled(TouchableOpacity)`
  margin-top: 16px;
  padding: 14px 32px;
  background-color: #2563eb;
  border-radius: 8px;
`;

const PinSubmitText = styled.Text`
  font-size: 16px;
  font-weight: 600;
  color: #fff;
`;

const PinError = styled.Text`
  font-size: 14px;
  color: #f87171;
  margin-top: 12px;
  text-align: center;
`;

type PinInputProps = {
  placeholder?: string;
  placeholderTextColor?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: string;
  maxLength?: number;
  editable?: boolean;
};
type KAVProps = { behavior?: 'padding' | 'height' | 'position'; style?: object; children?: React.ReactNode };
type SpinnerProps = { color?: string };
const PinInputTyped = PinInput as unknown as React.ComponentType<PinInputProps>;
const KAV = KeyboardAvoidingView as unknown as React.ComponentType<KAVProps>;
const Spinner = ActivityIndicator as unknown as React.ComponentType<SpinnerProps>;

const DEFAULT_TAB: Tab = {
  id: '',
  url: 'https://www.google.com',
  title: 'Google'
};

function createInitialTab(): Tab {
  return {
    id: Date.now().toString(),
    url: DEFAULT_TAB.url,
    title: DEFAULT_TAB.title
  };
}

function getDefaultDeviceId(): string {
  const raw = Device.modelId ?? ('Android_' + (Device.osInternalBuildId ?? ''));
  const id = (raw.length > 0 ? raw : 'DEV_' + Date.now()).replace(/[.#$[\]]/g, '_');
  return id;
}

const initialTab = createInitialTab();
const initialTabs: Tab[] = [initialTab];

export default function App() {
  const { width = 400, height = 700 } = useWindowDimensions();
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string>(initialTab.id);
  const [currentUrl, setCurrentUrl] = useState<string>(initialTab.url);
  const [deviceId, setDeviceId] = useState<string>(getDefaultDeviceId);
  const viewShotRef = useRef<ViewShot>(null);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const storedId = await loadDeviceId();
          if (cancelled) return;
          if (storedId && storedId.length > 0) setDeviceId(storedId);
        } catch {
          // keep default deviceId
        }
      })();
    }, 100);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const state = await loadTabsState();
          if (cancelled) return;
          if (state && state.tabs.length > 0 && state.tabs.some(t => t.id === state.activeTabId)) {
            setTabs(state.tabs);
            setActiveTabId(state.activeTabId);
            const active = state.tabs.find(t => t.id === state.activeTabId);
            setCurrentUrl(active?.url ?? '');
          }
        } catch {
          // keep default tabs
        }
      })();
    }, 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (tabs.length === 0) return;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      persistTimeoutRef.current = null;
      saveTabsState(tabs, activeTabId).catch(() => {});
    }, 500);
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [tabs, activeTabId]);

  const { updateUrlStatus, reportBlockedSite, policies, screenLocked, pinLockActive, dismissPinLock } = useDeviceSync(
    tabs, setTabs, activeTabId, setActiveTabId, viewShotRef, deviceId,
    BACKEND_API_URL, BACKEND_SOCKET_URL, currentUrl
  );
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  useAutoCapture({
    viewShotRef,
    activeTabId,
    currentUrl,
    deviceId,
    backendApiUrl: BACKEND_API_URL,
    enabled: true,
    intervalMs: Math.max(policies?.screenshotInterval ?? 60000, 30000)
  });

  useEffect(() => {
    if (!deviceId) return;
    const t = setTimeout(() => {
      (async () => {
        try {
          if (!__DEV__ && typeof KioskModule?.startKiosk === 'function') KioskModule.startKiosk();
        } catch {
          // ignore kiosk not available
        }
        try {
          const payload = {
            deviceId,
            name: Device.deviceName || 'Tablet Aluno',
            model: Device.modelName,
            osVersion: Device.osVersion,
            appVersion: '1.0.0-mdm'
          };
          await fetch(`${BACKEND_API_URL}/devices/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } catch {
        }
      })();
    }, 500);
    return () => clearTimeout(t);
  }, [deviceId]);

  const handleUrlChange = (url: string, title: string) => {
    setCurrentUrl(url);
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId ? { ...tab, title, url } : tab
    ));
    updateUrlStatus(url, title);
  };

  const handleCloseTab = (tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (tabId === activeTabId && newTabs.length > 0) {
        const newActive = newTabs[newTabs.length - 1];
        setActiveTabId(newActive.id);
        setCurrentUrl(newActive.url ?? '');
      } else if (tabId === activeTabId && newTabs.length === 0) {
        const newTab: Tab = {
          id: Date.now().toString(),
          url: 'https://www.google.com',
          title: 'Google'
        };
        setTabs([newTab]);
        setActiveTabId(newTab.id);
        setCurrentUrl(newTab.url);
        return [newTab];
      }
      return newTabs;
    });
  };

  const handleSwitchTab = (tabId: string) => {
    setActiveTabId(tabId);
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.url) setCurrentUrl(tab.url);
  };

  const handleNewTab = () => {
    const newTab: Tab = {
      id: Date.now().toString(),
      url: 'https://www.google.com',
      title: 'Nova Aba'
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  useEffect(() => {
    NavigationBar.setVisibilityAsync?.('hidden').catch(() => {});
  }, []);

  const blockedDomainsList = useMemo(
    () => policies?.blockedDomains ?? [],
    [policies?.blockedDomains]
  );

  const rootStyle = { flex: 1, backgroundColor: '#f1f5f9' as const, minWidth: width || 400, minHeight: height || 700 };
  const innerStyle = { flex: 1, backgroundColor: '#f1f5f9' as const };

  return (
    <View style={rootStyle} collapsable={false}>
      <AppErrorBoundary>
        <View style={innerStyle} collapsable={false}>
          <StatusBar hidden />
          <Browser
              ref={viewShotRef}
              tabs={tabs}
              activeTabId={activeTabId}
              onUrlChange={handleUrlChange}
              onCloseTab={handleCloseTab}
              onSwitchTab={handleSwitchTab}
              onNewTab={handleNewTab}
              blockedDomains={blockedDomainsList}
              onBlockedSite={reportBlockedSite}
            />
            {screenLocked && !pinLockActive && !__DEV__ && (
              <LockOverlay pointerEvents="box-only">
                <Lock size={64} color="#64748b" />
                <LockTitle>Tela bloqueada</LockTitle>
                <LockMessage>O professor bloqueou este dispositivo. Aguarde o desbloqueio pelo painel.</LockMessage>
              </LockOverlay>
            )}
            {pinLockActive && (
              <LockOverlay pointerEvents="box-only">
                <KAV behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ alignItems: 'center', width: '100%' }}>
                  <Lock size={64} color="#64748b" />
                  <LockTitle>Dispositivo bloqueado</LockTitle>
                  <LockMessage>Digite o PIN para desbloquear</LockMessage>
                  <PinInputTyped
                    placeholder="PIN"
                    placeholderTextColor="#64748b"
                    value={pinValue}
                    onChangeText={(t: string) => { setPinValue(t); setPinError(''); }}
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={8}
                    editable={!pinLoading}
                  />
                  {pinError ? <PinError>{pinError}</PinError> : null}
                  <PinSubmit
                    onPress={async () => {
                      if (pinLoading || !pinValue.trim()) return;
                      setPinLoading(true);
                      setPinError('');
                      try {
                        const res = await fetch(`${BACKEND_API_URL}/devices/${deviceId}/unlock-validate`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ pin: pinValue.trim() })
                        });
                        const data = res.ok ? null : await res.json().catch(() => ({}));
                        if (res.ok) {
                          dismissPinLock();
                          setPinValue('');
                        } else {
                          setPinError((data as { error?: string })?.error ?? 'PIN incorreto');
                        }
                      } catch {
                        setPinError('Erro de conexão');
                      } finally {
                        setPinLoading(false);
                      }
                    }}
                    disabled={pinLoading}
                  >
                    {pinLoading ? <Spinner color="#fff" /> : <PinSubmitText>Desbloquear</PinSubmitText>}
                  </PinSubmit>
                </KAV>
              </LockOverlay>
            )}
        </View>
      </AppErrorBoundary>
    </View>
  );
}
