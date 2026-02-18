import { Platform, NativeModules, Linking } from 'react-native';
import * as Brightness from 'expo-brightness';
import * as IntentLauncher from 'expo-intent-launcher';

const { KioskModule } = NativeModules;

function safeNative<T>(fn: () => T): T | void {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function getAndroidPackage(): string {
  try {
    const Application = require('expo-application');
    const id = Application.applicationId ?? Application.default?.applicationId;
    if (id && typeof id === 'string') return id;
  } catch {
  }
  return 'com.octoclass.mobile';
}

async function openWriteSettingsScreen(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const packageName = getAndroidPackage();
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.MANAGE_WRITE_SETTINGS,
      { data: `package:${packageName}` }
    );
  } catch {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: `package:${packageName}` }
      );
    } catch {
      Linking.openSettings();
    }
  }
}

export class DeviceControls {
  static async openWriteSettingsOnce(): Promise<void> {
    return openWriteSettingsScreen();
  }

  static async canWriteSystemSettings(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      const fn = (KioskModule as { canWriteSystemSettings?: () => Promise<boolean> })?.canWriteSystemSettings;
      if (typeof fn !== 'function') return false;
      const result = await fn();
      return result === true;
    } catch {
      return false;
    }
  }

  static async setBrightness(level: number): Promise<void> {
    const clamped = Math.max(0, Math.min(1, Number(level)));
    try {
      await Brightness.setBrightnessAsync(clamped);
    } catch {
    }
    if (Platform.OS === 'android') {
      const hasModule = !!KioskModule;
      const hasSetBrightness = typeof (KioskModule as { setBrightness?: (n: number) => void })?.setBrightness === 'function';
      if (__DEV__ && (!hasModule || !hasSetBrightness)) {
        (console as { debug?: (a: string) => void }).debug?.('[DeviceControls] KioskModule=' + hasModule + ' setBrightness=' + hasSetBrightness);
      }
      safeNative(() => {
        if (hasSetBrightness) {
          (KioskModule as { setBrightness: (n: number) => void }).setBrightness(clamped);
        }
      });
      try {
        const { status } = await Brightness.getPermissionsAsync();
        if (status === 'granted' && typeof Brightness.setSystemBrightnessAsync === 'function') {
          await Brightness.setSystemBrightnessAsync(clamped);
        }
      } catch {
      }
    } else {
      try {
        const { status } = await Brightness.requestPermissionsAsync();
        if (status === 'granted') await Brightness.setBrightnessAsync(clamped);
      } catch {
      }
    }
  }

  static setVolume(level: number): void {
    if (Platform.OS !== 'android') return;
    const hasSetVolume = typeof KioskModule?.setVolume === 'function';
    if (__DEV__ && !hasSetVolume) {
      (console as { debug?: (a: string) => void }).debug?.('[DeviceControls] KioskModule.setVolume not available');
    }
    safeNative(() => {
      if (hasSetVolume) {
        KioskModule.setVolume(Math.max(0, Math.min(1, Number(level))));
      }
    });
  }

  static launchApp(packageName: string): void {
    if (Platform.OS !== 'android' || !packageName) return;
    safeNative(() => {
      if (KioskModule?.launchPackage) KioskModule.launchPackage(packageName);
    });
  }

  static async lockScreen(): Promise<void> {
    if (Platform.OS !== 'android') return;
    const fn = (KioskModule as { lockScreen?: () => Promise<boolean> })?.lockScreen;
    if (typeof fn === 'function') await fn();
  }

  static async launchCamera(): Promise<void> {
    const { launchCamera } = require('./DeviceControls.camera');
    await launchCamera();
  }

  static launchCalculator(): void {
    if (Platform.OS !== 'android') return;
    safeNative(() => {
      if (KioskModule?.launchCalculator) KioskModule.launchCalculator();
    });
  }

  static setAppStoreEnabled(enabled: boolean): void {
    if (Platform.OS !== 'android') return;
    safeNative(() => {
      if (KioskModule?.setAppStoreEnabled) KioskModule.setAppStoreEnabled(enabled);
    });
  }

  static reboot(): void {
    if (Platform.OS !== 'android') return;
    safeNative(() => {
      (KioskModule as any)?.reboot?.();
    });
  }

  static async getBrightness(): Promise<number> {
    try {
      return await Brightness.getBrightnessAsync();
    } catch (error) {
      return 0.5;
    }
  }

  static async requestBrightnessPermissions(): Promise<boolean> {
    try {
      const { status } = await Brightness.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      return false;
    }
  }
}
