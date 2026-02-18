import React, { forwardRef, useEffect, useRef, useState } from 'react';
import styled from 'styled-components/native';
import { WebView } from 'react-native-webview';
import { ActivityIndicator, View } from 'react-native';
import { TouchableOpacity, ScrollView, Platform } from './rn';
import ViewShot from 'react-native-view-shot';
import { Tab } from '../types';
import { ANDROID_FULL_BROWSER } from '../config/Constants';

const LoadingSpinner: React.FC<{ size?: 'small' | 'large'; color?: string }> = (props) =>
  React.createElement(ActivityIndicator as unknown as React.ComponentType<{ size?: 'small' | 'large'; color?: string }>, props);
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Plus,
  X,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Home,
  Globe,
  MoreVertical
} from 'lucide-react-native';

interface BrowserProps {
  tabs: Tab[];
  activeTabId: string;
  onUrlChange: (url: string, title: string) => void;
  onCloseTab?: (tabId: string) => void;
  onSwitchTab?: (tabId: string) => void;
  onNewTab?: () => void;
  blockedDomains?: string[];
  onBlockedSite?: (url: string) => void;
}


const Container = styled.View`
  flex: 1;
  background-color: #f1f5f9;
`;

const HeaderContainer = styled.View`
  background-color: #ffffff;
  border-bottom-width: 1px;
  border-bottom-color: #e2e8f0;
  padding-top: ${Platform.OS === 'android' ? '12px' : '0px'};
  z-index: 10;
`;

const TabsContainer = styled.View`
  height: 48px;
  flex-direction: row;
  align-items: center;
  padding-horizontal: 12px;
  background-color: #f8fafc;
`;

interface TabItemProps {
  isActive: boolean;
}
const TabItem = styled.TouchableOpacity<TabItemProps>`
  background-color: ${(p: TabItemProps) => (p.isActive ? '#ffffff' : '#f1f5f9')};
  padding: 8px 14px;
  margin-right: 6px;
  border-top-left-radius: 10px;
  border-top-right-radius: 10px;
  flex-direction: row;
  align-items: center;
  border-left-width: 1px;
  border-right-width: 1px;
  border-top-width: 1px;
  border-color: ${(p: TabItemProps) => (p.isActive ? '#e2e8f0' : 'transparent')};
  min-width: 120px;
  max-width: 180px;
  height: 40px;
  margin-top: 8px;
`;

const TabTitle = styled.Text<TabItemProps>`
  font-size: 13px;
  font-weight: ${(p: TabItemProps) => (p.isActive ? '600' : '500')};
  color: ${(p: TabItemProps) => (p.isActive ? '#0f172a' : '#64748b')};
  flex: 1;
`;

const CloseTabButton = styled.TouchableOpacity`
  padding: 4px;
  border-radius: 12px;
  margin-left: 8px;
`;

const AddTabButton = styled.TouchableOpacity`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background-color: #f1f5f9;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
  border-width: 1px;
  border-color: #e2e8f0;
`;

const NavBar = styled.View`
  flex-direction: row;
  align-items: center;
  padding: 10px 16px;
  gap: 14px;
  height: 64px;
  background-color: #ffffff;
`;

interface NavButtonProps {
  disabled?: boolean;
}
const NavButton = styled.TouchableOpacity<NavButtonProps>`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background-color: ${(p: NavButtonProps) => (p.disabled ? 'transparent' : '#f1f5f9')};
  align-items: center;
  justify-content: center;
  opacity: ${(p: NavButtonProps) => (p.disabled ? 0.4 : 1)};
  border-width: 1px;
  border-color: ${(p: NavButtonProps) => (p.disabled ? 'transparent' : '#e2e8f0')};
`;

const UrlBar = styled.View`
  flex: 1;
  background-color: #f8fafc;
  border-radius: 12px;
  padding: 0 14px;
  height: 44px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  border-width: 1.5px;
  border-color: #cbd5e1;
`;

const UrlText = styled.Text`
  font-size: 14px;
  color: #1e293b;
  font-weight: 500;
  flex: 1;
`;

interface WebViewWrapperProps {
  isVisible: boolean;
}
const WebViewWrapper = styled.View<WebViewWrapperProps>`
  flex: 1;
  min-height: 200px;
  display: ${(p: WebViewWrapperProps) => (p.isVisible ? 'flex' : 'none')};
  background-color: #f1f5f9;
`;

const EmptyState = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  background-color: #f1f5f9;
`;

const EmptyText = styled.Text`
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin-top: 20px;
`;

const StatusText = styled.Text`
  font-size: 16px;
  color: #64748b;
  margin-top: 10px;
`;

const BlockedOverlay = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #f8fafc;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 32px;
`;

const BlockedCard = styled.View`
  background-color: #ffffff;
  border-radius: 20px;
  padding: 32px 28px;
  align-items: center;
  max-width: 340px;
  shadow-color: #000;
  shadow-offset: 0 4px;
  shadow-opacity: 0.06;
  shadow-radius: 12px;
  elevation: 4;
  border-width: 1px;
  border-color: #e2e8f0;
`;

const BlockedTitle = styled.Text`
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin-top: 20px;
  text-align: center;
`;

const BlockedDescription = styled.Text`
  font-size: 16px;
  color: #64748b;
  margin-top: 12px;
  text-align: center;
  line-height: 24px;
`;

const BlockedUrl = styled.Text`
  font-size: 14px;
  color: #94a3b8;
  margin-top: 20px;
  background-color: #f1f5f9;
  padding: 10px 16px;
  border-radius: 10px;
  font-weight: 500;
`;

const GoBackButton = styled.TouchableOpacity`
  background-color: #3b82f6;
  padding: 16px 28px;
  border-radius: 14px;
  margin-top: 28px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  elevation: 2;
  shadow-color: #3b82f6;
  shadow-offset: 0 2px;
  shadow-opacity: 0.2;
  shadow-radius: 6px;
`;

const GoBackText = styled.Text`
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
`;

const DEFERRED_LOAD_DELAY_MS = 1800;
const WEBVIEW_MOUNT_DELAY_MS = 200;
const ABOUT_BLANK = 'about:blank';

const ANDROID_SAFE_HTML = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#f1f5f9;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;box-sizing:border-box">
  <h1 style="color:#0f172a;font-size:24px;margin-bottom:16px">Octaclass</h1>
  <p style="color:#475569;text-align:center;max-width:320px;line-height:1.5">Navegador seguro. O app está em execução.</p>
  <p style="color:#64748b;font-size:14px;margin-top:24px;text-align:center">Em emulador Android o WebView pode instabilizar ao carregar sites. Use um dispositivo físico para acesso completo à web.</p>
</body></html>
`;

const ANDROID_SAFE_MODE = Platform.OS === 'android' && !ANDROID_FULL_BROWSER;

function getWebViewSource(uri: string): { uri: string } | { html: string } {
  if (ANDROID_SAFE_MODE && uri !== ABOUT_BLANK && (uri.startsWith('http://') || uri.startsWith('https://'))) {
    return { html: ANDROID_SAFE_HTML };
  }
  return { uri };
}

const BrowserComponent = forwardRef<ViewShot, BrowserProps>(
  ({ tabs, activeTabId, onUrlChange, onCloseTab, onSwitchTab, onNewTab, blockedDomains = [], onBlockedSite }, ref) => {
    const webViewRefs = useRef<{ [key: string]: WebView | null }>({});
    const deferredTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [currentUrl, setCurrentUrl] = useState('');
    const [isSecure, setIsSecure] = useState(false);
    const [loading, setLoading] = useState(false);
    const [blockedUrl, setBlockedUrl] = useState<string | null>(null);
    const [deferredUrlLoadedByTab, setDeferredUrlLoadedByTab] = useState<Record<string, boolean>>({});
    const [webViewErrorByTab, setWebViewErrorByTab] = useState<Record<string, boolean>>({});
    const [webViewAllowedToMount, setWebViewAllowedToMount] = useState(false);

    useEffect(() => {
      const t = setTimeout(() => setWebViewAllowedToMount(true), WEBVIEW_MOUNT_DELAY_MS);
      return () => clearTimeout(t);
    }, []);

    const isUrlBlocked = (url: string): boolean => {
      if (!url || typeof url !== 'string') return false;
      const playStore = url.includes('play.google.com') || url.startsWith('market://');
      const domainBlock = blockedDomains.some((d) => d && url.toLowerCase().includes(d.toLowerCase()));
      return playStore || domainBlock;
    };

    useEffect(() => {
      return () => {
        Object.values(deferredTimeoutRef.current).forEach((t) => clearTimeout(t));
      };
    }, []);

    useEffect(() => {
      if (currentUrl && isUrlBlocked(currentUrl) && !blockedUrl) {
        setBlockedUrl(currentUrl);
        onBlockedSite?.(currentUrl);
      }
    }, [blockedDomains, currentUrl, blockedUrl]);

    const handleLoadEnd = (tabId: string) => {
      if (deferredUrlLoadedByTab[tabId]) return;
      const t = setTimeout(() => {
        delete deferredTimeoutRef.current[tabId];
        setDeferredUrlLoadedByTab((prev) => ({ ...prev, [tabId]: true }));
      }, DEFERRED_LOAD_DELAY_MS);
      deferredTimeoutRef.current[tabId] = t;
    };

    const handleWebViewError = (tabId: string) => {
      setWebViewErrorByTab((prev) => ({ ...prev, [tabId]: true }));
    };

    const retryWebView = (tabId: string) => {
      setWebViewErrorByTab((prev) => ({ ...prev, [tabId]: false }));
      setDeferredUrlLoadedByTab((prev) => ({ ...prev, [tabId]: true }));
    };

    const handleShouldStartLoad = (request: any) => {
      const url = request?.url ?? request?.nativeEvent?.url ?? '';
      if (isUrlBlocked(url)) {
        setBlockedUrl(url);
        onBlockedSite?.(url);
        return false;
      }
      return true;
    };

    const handleNavigationStateChange = (navState: any, tabId: string) => {
      if (tabId === activeTabId) {
        setCanGoBack(navState.canGoBack);
        setCanGoForward(navState.canGoForward);
        setCurrentUrl(navState.url);
        setIsSecure(navState.url?.startsWith('https'));
        setLoading(navState.loading);
        onUrlChange(navState.url || '', navState.title || 'Carregando...');
        if (!navState.loading && navState.url && isUrlBlocked(navState.url)) {
          setBlockedUrl(navState.url);
          onBlockedSite?.(navState.url);
        }
      }
    };

    const goBack = () => webViewRefs.current[activeTabId]?.goBack();
    const goForward = () => webViewRefs.current[activeTabId]?.goForward();
    const reload = () => webViewRefs.current[activeTabId]?.reload();
    const goHome = () => {
      onUrlChange('https://www.google.com', 'Google');
    };

    const getDomain = (url: string) => {
      try {
        const hostname = new URL(url).hostname;
        return hostname.startsWith('www.') ? hostname.substring(4) : hostname;
      } catch {
        return url || 'Nova Aba';
      }
    };

    return (
      <Container collapsable={false} style={{ flex: 1, minHeight: 200 }}>
        <ViewShot ref={ref} options={{ format: 'jpg', quality: 0.5, result: 'base64' }} style={{ flex: 1 }}>
          {tabs.length > 0 && (
            <HeaderContainer>
              <TabsContainer>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'flex-end' }}>
                  {tabs.map((tab) => (
                    <TabItem
                      key={tab.id}
                      isActive={tab.id === activeTabId}
                      onPress={() => onSwitchTab?.(tab.id)}
                    >
                      <Globe size={14} color={tab.id === activeTabId ? '#3b82f6' : '#64748b'} style={{ marginRight: 6 }} />
                      <TabTitle isActive={tab.id === activeTabId} numberOfLines={1}>
                        {tab.title || 'Nova Aba'}
                      </TabTitle>
                      {tabs.length > 1 && (
                        <CloseTabButton onPress={() => onCloseTab?.(tab.id)}>
                          <X size={14} color={tab.id === activeTabId ? '#0f172a' : '#94a3b8'} />
                        </CloseTabButton>
                      )}
                    </TabItem>
                  ))}
                  <AddTabButton onPress={onNewTab}>
                    <Plus size={20} color="#475569" />
                  </AddTabButton>
                </ScrollView>
              </TabsContainer>

              <NavBar>
                <NavButton disabled={!canGoBack} onPress={goBack}>
                  <ChevronLeft size={24} color={!canGoBack ? '#94a3b8' : '#3b82f6'} strokeWidth={2.5} />
                </NavButton>

                <NavButton disabled={!canGoForward} onPress={goForward}>
                  <ChevronRight size={24} color={!canGoForward ? '#94a3b8' : '#3b82f6'} strokeWidth={2.5} />
                </NavButton>

                <NavButton onPress={reload}>
                  {loading ? <X size={22} color="#475569" strokeWidth={2.5} /> : <RotateCw size={22} color="#475569" strokeWidth={2.5} />}
                </NavButton>

                <UrlBar>
                  {isSecure ? <Lock size={16} color="#10b981" /> : <AlertTriangle size={16} color="#f59e0b" />}
                  <UrlText numberOfLines={1}>{getDomain(currentUrl)}</UrlText>
                  <MoreVertical size={20} color="#64748b" />
                </UrlBar>

                <NavButton onPress={goHome}>
                  <Home size={22} color="#475569" strokeWidth={2.5} />
                </NavButton>
              </NavBar>
            </HeaderContainer>
          )}

          {tabs.map((tab) => {
            const isActiveTab = tab.id === activeTabId;
            const useDirectUrl = !ANDROID_SAFE_MODE;
            const uriToLoad = useDirectUrl ? tab.url : (deferredUrlLoadedByTab[tab.id] ? tab.url : ABOUT_BLANK);
            const isDeferred = !ANDROID_SAFE_MODE ? false : !deferredUrlLoadedByTab[tab.id];
            const hasError = webViewErrorByTab[tab.id];
            const showWebView = webViewAllowedToMount && isActiveTab && !ANDROID_SAFE_MODE;
            return (
              <WebViewWrapper key={tab.id} isVisible={isActiveTab}>
                {ANDROID_SAFE_MODE && isActiveTab ? (
                  <View style={{ flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', minHeight: 200, padding: 24 }}>
                    <Globe size={48} color="#3b82f6" style={{ marginBottom: 16 }} />
                    <EmptyText style={{ marginBottom: 8, textAlign: 'center' }}>Octaclass</EmptyText>
                    <StatusText style={{ textAlign: 'center' }}>Navegador embutido desativado (modo seguro). Defina EXPO_PUBLIC_ANDROID_SAFE_WEBVIEW=false no .env ou use dispositivo físico para o navegador dentro do app.</StatusText>
                  </View>
                ) : !webViewAllowedToMount ? (
                  <View style={{ flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                    <LoadingSpinner size="large" color="#3b82f6" />
                    <StatusText style={{ marginTop: 12 }}>Iniciando navegador...</StatusText>
                  </View>
                ) : hasError ? (
                  <View style={{ flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', minHeight: 200, padding: 24 }}>
                    <AlertTriangle size={48} color="#f59e0b" style={{ marginBottom: 12 }} />
                    <StatusText style={{ textAlign: 'center', marginBottom: 16 }}>Falha ao carregar a página. Verifique a conexão ou tente novamente.</StatusText>
                    <GoBackButton onPress={() => retryWebView(tab.id)}>
                      <RotateCw size={20} color="#ffffff" />
                      <GoBackText>Tentar novamente</GoBackText>
                    </GoBackButton>
                  </View>
                ) : showWebView ? (
                  <WebView
                    ref={(inst) => { webViewRefs.current[tab.id] = inst; }}
                    source={getWebViewSource(uriToLoad)}
                    style={{ flex: 1, backgroundColor: '#f1f5f9', minHeight: 200 }}
                    onNavigationStateChange={(navState) => handleNavigationStateChange(navState, tab.id)}
                    onShouldStartLoadWithRequest={handleShouldStartLoad}
                    onLoadEnd={() => isDeferred && handleLoadEnd(tab.id)}
                    onError={() => handleWebViewError(tab.id)}
                    onHttpError={() => handleWebViewError(tab.id)}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    startInLoadingState={true}
                    renderLoading={() => (
                      <View style={{ flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                        <LoadingSpinner size="large" color="#3b82f6" />
                      </View>
                    )}
                    allowsBackForwardNavigationGestures={true}
                    mixedContentMode="compatibility"
                  />
                ) : (
                  <View style={{ flex: 1, backgroundColor: '#f1f5f9', minHeight: 200 }} />
                )}
              </WebViewWrapper>
            );
          })}

          {tabs.length === 0 && (
            <EmptyState>
              <ShieldCheck size={80} color="#3b82f6" style={{ opacity: 0.8 }} />
              <EmptyText>Octoclass Browser</EmptyText>
              <StatusText>Ambiente Seguro e Gerenciado</StatusText>
              <TouchableOpacity
                onPress={onNewTab}
                style={{
                  marginTop: 32,
                  backgroundColor: '#0f172a',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 12
                }}
              >
                <GoBackText>Abrir Nova Aba</GoBackText>
              </TouchableOpacity>
            </EmptyState>
          )}

          {blockedUrl && (
            <BlockedOverlay>
              <BlockedCard>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
                  <ShieldCheck size={48} color="#0ea5e9" />
                  <Lock size={32} color="#64748b" />
                </View>
                <BlockedTitle>Este site não está liberado</BlockedTitle>
                <BlockedDescription>
                  Para manter o foco na aula, use apenas os sites que o professor liberou. Volte e escolha um link da atividade.
                </BlockedDescription>
                <BlockedUrl>{getDomain(blockedUrl)}</BlockedUrl>
                <GoBackButton onPress={() => setBlockedUrl(null)}>
                  <ChevronLeft size={20} color="#ffffff" />
                  <GoBackText>Voltar ao navegador</GoBackText>
                </GoBackButton>
              </BlockedCard>
            </BlockedOverlay>
          )}
        </ViewShot>
      </Container>
    );
  }
);

BrowserComponent.displayName = 'Browser';
export const Browser = BrowserComponent;
