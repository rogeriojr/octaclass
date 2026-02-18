import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, FlatList, Alert } from './rn';
import { WebView } from 'react-native-webview';

interface Tab {
  id: string;
  url: string;
  title: string;
}

interface InAppBrowserProps {
  initialUrl?: string;
  blockedDomains?: string[];
  onUrlChange?: (url: string) => void;
  onTabsChange?: (tabs: Tab[]) => void;
}

export const InAppBrowser: React.FC<InAppBrowserProps> = ({
  initialUrl = 'https://www.google.com',
  blockedDomains = [],
  onUrlChange,
  onTabsChange
}) => {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', url: initialUrl, title: 'Nova Aba' }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const webViewRefs = useRef<{ [key: string]: WebView | null }>({});

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  useEffect(() => {
    onTabsChange?.(tabs);
  }, [tabs]);

  const isUrlBlocked = (url: string): boolean => {
    return blockedDomains.some(domain => url.includes(domain));
  };

  const handleNavigationStateChange = (navState: any, tabId: string) => {
    const { url, title } = navState;

    if (isUrlBlocked(url)) {
      Alert.alert(
        'Site Bloqueado',
        'Este site foi bloqueado pelo administrador.',
        [{ text: 'OK' }]
      );
      webViewRefs.current[tabId]?.goBack();
      return;
    }

    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId ? { ...tab, url, title: title || url } : tab
      )
    );

    if (tabId === activeTabId) {
      onUrlChange?.(url);
    }
  };

  const addTab = () => {
    const newTab: Tab = {
      id: Date.now().toString(),
      url: initialUrl,
      title: 'Nova Aba'
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) {
      Alert.alert('Aviso', 'Você deve manter pelo menos uma aba aberta.');
      return;
    }

    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const newActiveIndex = Math.max(0, tabIndex - 1);
      setActiveTabId(newTabs[newActiveIndex].id);
    }
  };

  const reloadTab = () => {
    webViewRefs.current[activeTabId]?.reload();
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <FlatList
          horizontal
          data={tabs}
          keyExtractor={(item: Tab) => item.id}
          renderItem={({ item }: { item: Tab }) => (
            <TouchableOpacity
              style={[
                styles.tab,
                item.id === activeTabId && styles.activeTab
              ]}
              onPress={() => setActiveTabId(item.id)}
            >
              <Text
                style={[
                  styles.tabTitle,
                  item.id === activeTabId && styles.activeTabTitle
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <TouchableOpacity
                onPress={() => closeTab(item.id)}
                style={styles.closeButton}
              >
                <Text style={[styles.iconText, { color: item.id === activeTabId ? '#fff' : '#666' }]}>×</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity onPress={addTab} style={styles.addTabButton}>
          <Text style={styles.iconText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={reloadTab} style={styles.reloadButton}>
          <Text style={styles.iconText}>↻</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.webViewContainer}>
        {tabs.map(tab => (
          <WebView
            key={tab.id}
            ref={(ref) => {
              if (ref) webViewRefs.current[tab.id] = ref;
            }}
            source={{ uri: tab.url }}
            style={[
              styles.webView,
              tab.id !== activeTabId && styles.hiddenWebView
            ]}
            onNavigationStateChange={navState =>
              handleNavigationStateChange(navState, tab.id)
            }
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            scalesPageToFit
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center'
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    maxWidth: 150
  },
  activeTab: {
    backgroundColor: '#4a90e2'
  },
  tabTitle: {
    color: '#999',
    fontSize: 12,
    marginRight: 8,
    flex: 1
  },
  activeTabTitle: {
    color: '#fff',
    fontWeight: '600'
  },
  closeButton: {
    padding: 2
  },
  addTabButton: {
    backgroundColor: '#4a90e2',
    padding: 8,
    borderRadius: 8,
    marginRight: 8
  },
  reloadButton: {
    backgroundColor: '#4a90e2',
    padding: 8,
    borderRadius: 8
  },
  iconText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold'
  },
  webViewContainer: {
    flex: 1
  },
  webView: {
    flex: 1
  },
  hiddenWebView: {
    display: 'none'
  }
});
