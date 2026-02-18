import { Tab } from '../types';

const TABS_KEY = '@octaclass/tabs';
const ACTIVE_TAB_ID_KEY = '@octaclass/activeTabId';
const DEVICE_ID_KEY = '@octaclass/deviceId';
const PIN_LOCK_ACTIVE_KEY = '@octaclass/pinLockActive';

export type PersistedTabsState = { tabs: Tab[]; activeTabId: string } | null;

function getStorage(): typeof import('@react-native-async-storage/async-storage').default | null {
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

export async function loadTabsState(): Promise<PersistedTabsState> {
  try {
    const AsyncStorage = getStorage();
    if (!AsyncStorage) return null;
    const [tabsJson, activeTabId] = await Promise.all([
      AsyncStorage.getItem(TABS_KEY),
      AsyncStorage.getItem(ACTIVE_TAB_ID_KEY)
    ]);
    if (!tabsJson || !activeTabId) return null;
    const tabs: Tab[] = JSON.parse(tabsJson);
    if (!Array.isArray(tabs) || tabs.length === 0) return null;
    const hasActive = tabs.some(t => t.id === activeTabId);
    if (!hasActive) return null;
    return { tabs, activeTabId };
  } catch {
    return null;
  }
}

export async function saveTabsState(tabs: Tab[], activeTabId: string): Promise<void> {
  try {
    const AsyncStorage = getStorage();
    if (!AsyncStorage) return;
    await Promise.all([
      AsyncStorage.setItem(TABS_KEY, JSON.stringify(tabs)),
      AsyncStorage.setItem(ACTIVE_TAB_ID_KEY, activeTabId)
    ]);
  } catch {
  }
}

export async function loadDeviceId(): Promise<string | null> {
  try {
    const AsyncStorage = getStorage();
    if (!AsyncStorage) return null;
    return await AsyncStorage.getItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

export async function saveDeviceId(deviceId: string): Promise<void> {
  try {
    const AsyncStorage = getStorage();
    if (!AsyncStorage) return;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch {
  }
}

export async function loadPinLockActive(): Promise<boolean> {
  try {
    const AsyncStorage = getStorage();
    if (!AsyncStorage) return false;
    const v = await AsyncStorage.getItem(PIN_LOCK_ACTIVE_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

export async function savePinLockActive(active: boolean): Promise<void> {
  try {
    const AsyncStorage = getStorage();
    if (!AsyncStorage) return;
    await AsyncStorage.setItem(PIN_LOCK_ACTIVE_KEY, active ? 'true' : 'false');
  } catch {
  }
}
