type PolicyInput = {
  blockedDomains: string;
  allowedApps: string;
  blockedApps?: string;
  unlockPin?: string | null;
} | null | undefined;

export function safeParsePolicy(policy: PolicyInput) {
  if (!policy) return null;
  try {
    const { unlockPin, ...rest } = policy as { unlockPin?: string | null };
    return {
      ...rest,
      blockedDomains: JSON.parse(policy.blockedDomains),
      allowedApps: JSON.parse(policy.allowedApps),
      blockedApps: JSON.parse((policy as { blockedApps?: string }).blockedApps ?? '[]'),
      hasUnlockPin: !!(unlockPin != null && String(unlockPin).trim() !== '')
    };
  } catch {
    return null;
  }
}

type DeviceWithPolicy = {
  deviceId: string;
  lastSeen: Date;
  policy?: {
    blockedDomains: string;
    allowedApps: string;
    blockedApps?: string;
    screenshotInterval: number;
    kioskMode: boolean;
    unlockPin?: string | null;
  } | null;
  [k: string]: unknown;
};

export function formatDeviceForSocket(d: DeviceWithPolicy) {
  return {
    ...d,
    id: d.deviceId,
    lastSeen: new Date(d.lastSeen).getTime(),
    policies: safeParsePolicy(d.policy ?? null)
  };
}
