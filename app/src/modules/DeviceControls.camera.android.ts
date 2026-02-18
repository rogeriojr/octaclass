import { NativeModules } from 'react-native';

const { KioskModule } = NativeModules;

export async function launchCamera(): Promise<void> {
  try {
    if (KioskModule?.launchCamera) {
      KioskModule.launchCamera();
    }
  } catch {
  }
}
