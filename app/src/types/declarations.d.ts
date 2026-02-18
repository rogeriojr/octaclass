declare module 'react-native-safe-area-context';
declare module 'expo-brightness';
declare module 'expo-intent-launcher';
declare module 'expo-application';
declare module 'expo-image-picker';
declare module 'react-native-view-shot';
declare module 'styled-components/native';

import type { ComponentType } from 'react';

declare module 'react-native' {
  export const View: ComponentType<any>;
  export const Text: ComponentType<any>;
  export const ScrollView: ComponentType<any>;
  export const TouchableOpacity: ComponentType<any>;
  export const FlatList: ComponentType<any>;
}
