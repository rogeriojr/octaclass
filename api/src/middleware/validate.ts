import { z } from 'zod';

export const registerDeviceSchema = z.object({
  deviceId: z.string().min(3),
  name: z.string().optional(),
  model: z.string().optional(),
  osVersion: z.string().optional(),
  appVersion: z.string().optional()
});

export const updatePolicySchema = z.object({
  blockedDomains: z.array(z.string()).optional(),
  allowedApps: z.array(z.string()).optional(),
  blockedApps: z.array(z.string()).optional(),
  screenshotInterval: z.number().min(5000).max(3600000).optional(),
  kioskMode: z.boolean().optional(),
  unlockPin: z.string().max(32).nullable().optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const registerUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['student', 'teacher'])
});

export const updateGlobalPolicySchema = z.object({
  blockedDomains: z.array(z.string().max(253)).optional(),
  allowedApps: z.array(z.string().max(256)).optional(),
  screenshotInterval: z.number().min(10000).max(3600000).optional(),
  kioskMode: z.boolean().optional()
});

export const screenshotUploadSchema = z.object({
  deviceId: z.string().min(1),
  image: z.string().min(100),
  timestamp: z.union([z.number(), z.string()]).optional(),
  event: z.string().max(32).optional(),
  url: z.string().max(2048).optional().nullable(),
  tabId: z.string().max(64).optional().nullable()
});
