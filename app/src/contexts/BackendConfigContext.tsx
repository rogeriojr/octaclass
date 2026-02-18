import * as React from 'react';

const { createContext, useContext } = React;

type BackendConfig = {
  apiUrl: string;
  socketUrl: string;
  host: string;
  port: string;
  isReady: boolean;
};

const defaultConfig: BackendConfig = {
  apiUrl: '',
  socketUrl: '',
  host: '',
  port: '',
  isReady: true
};

const BackendConfigContext = createContext<BackendConfig>(defaultConfig);

export function BackendConfigProvider({ children }: { children: React.ReactNode }) {
  return (
    <BackendConfigContext.Provider value={defaultConfig}>
      {children}
    </BackendConfigContext.Provider>
  );
}

export function useBackendConfig(): BackendConfig {
  return useContext(BackendConfigContext);
}
