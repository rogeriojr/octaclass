import { useEffect, useRef } from 'react';
import { captureScreen } from 'react-native-view-shot';

interface AutoCaptureOptions {
  viewShotRef: React.RefObject<unknown>;
  activeTabId: string;
  currentUrl: string;
  deviceId: string;
  backendApiUrl: string;
  enabled?: boolean;
  intervalMs?: number;
}

export const useAutoCapture = ({
  viewShotRef,
  activeTabId,
  currentUrl,
  deviceId,
  backendApiUrl,
  enabled = true,
  intervalMs = 60000
}: AutoCaptureOptions) => {
  const lastCaptureRef = useRef<{
    tabId: string;
    url: string;
    timestamp: number;
  }>({
    tabId: '',
    url: '',
    timestamp: 0
  });

  const logActivity = (trigger: string, url?: string) => {
    fetch(`${backendApiUrl}/devices/${deviceId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SCREENSHOT_CAPTURED',
        details: { trigger, url: url ?? currentUrl }
      })
    }).catch(() => {});
  };

  const CAPTURE_OPTS = { format: 'jpg' as const, quality: 0.5, result: 'base64' as const };

  const doCapture = async (event: 'AUTO_TIMER' | 'TAB_CHANGE' | 'URL_CHANGE' | 'MANUAL') => {
    if (!enabled) return;

    let base64: string | null = null;
    try {
      base64 = await captureScreen(CAPTURE_OPTS);
      if (base64 == null || base64 === '') return;

      const imagePayload = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
      const res = await fetch(`${backendApiUrl}/screenshots/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          image: imagePayload,
          timestamp: Date.now(),
          event,
          tabId: activeTabId,
          url: currentUrl
        })
      });
      if (!res.ok) return;

      lastCaptureRef.current = {
        tabId: activeTabId,
        url: currentUrl,
        timestamp: Date.now()
      };
      logActivity(event, currentUrl);
    } catch {
    }
  };

  const INITIAL_CAPTURE_DELAY_MS = 30000;

  useEffect(() => {
    if (!enabled) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const t = setTimeout(() => {
      intervalId = setInterval(() => doCapture('AUTO_TIMER'), intervalMs);
    }, INITIAL_CAPTURE_DELAY_MS);
    return () => {
      clearTimeout(t);
      if (intervalId != null) clearInterval(intervalId);
    };
  }, [enabled, intervalMs]);

  useEffect(() => {
    if (!enabled) return;
    if (lastCaptureRef.current.tabId !== activeTabId) {
      doCapture('TAB_CHANGE');
    }
  }, [activeTabId, enabled]);

  useEffect(() => {
    if (!enabled || !currentUrl) return;
    if (lastCaptureRef.current.url !== currentUrl) {
      const timeSince = Date.now() - lastCaptureRef.current.timestamp;
      if (timeSince > 2000) {
        doCapture('URL_CHANGE');
      }
    }
  }, [currentUrl, enabled]);

  return { captureScreen: doCapture };
};
