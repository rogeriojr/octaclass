import { NativeModules } from 'react-native';

const { KioskModule } = NativeModules;

export interface KioskInterface {
  startKiosk(): void;
  stopKiosk(): void;
  isDeviceOwner(): Promise<boolean>;
  setAllowedPackages(packages: string[]): void;
  setBlockedPackages(packages: string[]): void;
  setVolume(level: number): void;
  setBrightness(level: number): void;
  lockScreen(): Promise<boolean>;
  launchCamera(): void;
  launchCalculator(): void;
  launchPackage(packageName: string): void;
  setAppStoreEnabled(enabled: boolean): void;
}

export default KioskModule as KioskInterface;
