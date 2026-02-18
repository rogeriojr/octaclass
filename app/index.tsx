import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { registerRootComponent } from 'expo';
import App from './App';

const originalFetch = globalThis.fetch;
if (typeof originalFetch === 'function') {
  (globalThis as any).fetch = function fetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    return originalFetch.call(globalThis, input, init).then(
      (response) => {
        if (response.status === 0) {
          throw new Error('Network request failed');
        }
        return response;
      },
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (err instanceof RangeError || /status.*200.*599/i.test(msg)) {
          throw new Error('Network request failed');
        }
        throw err;
      }
    );
  };
}

type RootState = { hasError: boolean; error: Error | null };
class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, RootState> {
  state: RootState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): RootState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#f1f5f9', padding: 24, justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 }}>Erro ao abrir o app</Text>
          <Text style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>{this.state.error.message}</Text>
          {this.state.error.stack ? (
            <ScrollView style={{ maxHeight: 200 }}>
              <Text style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }} selectable>
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

const rootOuterStyle = { flex: 1, backgroundColor: '#f1f5f9' as const };
const rootInnerStyle = { flex: 1, backgroundColor: '#f1f5f9' as const };

function Root() {
  return (
    <RootErrorBoundary>
      <View style={rootOuterStyle} collapsable={false}>
        <View style={rootInnerStyle} collapsable={false}>
          <App />
        </View>
      </View>
    </RootErrorBoundary>
  );
}

registerRootComponent(Root);
