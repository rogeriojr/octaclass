import express, { Request, Response } from 'express';
import prisma from '../prisma';
import { getGateway } from '../socket/gateway';
import { getAndroidManagementService } from '../services/android-management-singleton';
import { formatDeviceForSocket, safeParsePolicy } from '../utils/formatDevice';
import { updateDeviceHeartbeat } from '../utils/deviceUpdate';

type PolicyUpdateData = {
  blockedDomains?: string;
  allowedApps?: string;
  blockedApps?: string;
  screenshotInterval?: number;
  kioskMode?: boolean;
  unlockPin?: string | null;
};

type PolicyWithBlockedApps = { blockedDomains: string; allowedApps: string; blockedApps?: string; screenshotInterval: number; kioskMode: boolean; unlockPin?: string | null };

const router = express.Router();

function fireWebhook(event: string, payload: Record<string, unknown>): void {
  const url = process.env.WEBHOOK_URL;
  if (!url || typeof url !== 'string' || url.trim() === '') return;
  const body = { event, timestamp: Date.now(), ...payload };
  fetch(url.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(() => {});
}

/**
 * @swagger
 * /api/devices/register:
 *   post:
 *     summary: Registrar dispositivo
 *     tags: [Devices]
 *     security: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceId]
 *             properties:
 *               deviceId: { type: string }
 *               name: { type: string }
 *               model: { type: string }
 *               osVersion: { type: string }
 *               appVersion: { type: string }
 *     responses:
 *       200: { description: Dispositivo criado ou atualizado }
 *       400: { description: Dados inválidos }
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { registerDeviceSchema } = require('../middleware/validate');
    const validatedData = registerDeviceSchema.parse(req.body);
    const { deviceId, name, model, osVersion, appVersion } = validatedData;

    let globalPolicy = await prisma.globalPolicy.findFirst();

    if (!globalPolicy) {
      globalPolicy = await prisma.globalPolicy.create({
        data: {
          name: 'Global',
          blockedDomains: JSON.stringify([
            'facebook.com', 'fb.com', 'instagram.com', 'tiktok.com',
            'twitter.com', 'x.com', 'snapchat.com', 'whatsapp.com',
            'telegram.org', 'discord.com', 'reddit.com', 'twitch.tv',
            'youtube.com/shorts', 'pinterest.com'
          ]),
          allowedApps: JSON.stringify([
            'com.android.calculator2',
            'com.google.android.keep',
            'com.octoclass'
          ]),
          screenshotInterval: 60000,
          kioskMode: true
        }
      });
    }

    const device = await prisma.device.upsert({
      where: { deviceId },
      update: {
        name: name || undefined,
        model,
        osVersion,
        appVersion,
        lastSeen: new Date(),
        status: 'online'
      },
      create: {
        deviceId,
        name: name || deviceId,
        model,
        osVersion,
        appVersion,
        status: 'online',
        policy: {
          create: {
            blockedDomains: globalPolicy.blockedDomains,
            allowedApps: globalPolicy.allowedApps,
            screenshotInterval: globalPolicy.screenshotInterval,
            kioskMode: globalPolicy.kioskMode
          }
        }
      },
      include: { policy: true }
    });

    const gateway = getGateway();
    if (gateway) {
      gateway.notifyDevice('all_admins', 'DEVICE_UPDATED', formatDeviceForSocket(device));
    }

    fireWebhook('device.registered', {
      deviceId: device.deviceId,
      name: device.name ?? undefined,
      model: device.model ?? undefined,
      osVersion: device.osVersion ?? undefined,
      appVersion: device.appVersion ?? undefined
    });

    res.json({ success: true, device });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    if (process.env.NODE_ENV !== 'production') {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Registration error:', err.message);
    }
    res.status(500).json({ error: 'Failed to register device' });
  }
});

/**
 * @swagger
 * /api/devices:
 *   get:
 *     summary: Listar dispositivos
 *     tags: [Devices]
 *     responses:
 *       200: { description: Lista de dispositivos com políticas }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const devices = await prisma.device.findMany({
      include: { policy: true }
    });

    const formattedDevices = devices.map((d: any) => ({
      ...d,
      id: d.deviceId,
      lastSeen: new Date(d.lastSeen).getTime(),
      policies: safeParsePolicy(d.policy)
    }));

    res.json(formattedDevices);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV !== 'production') {
      console.error('GET /api/devices error:', message);
    }
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

router.post('/commands/broadcast', async (req: Request, res: Response) => {
  const { type, payload } = req.body || {};
  if (!type || typeof type !== 'string') {
    return res.status(400).json({ error: 'type is required' });
  }
  try {
    const devices = await prisma.device.findMany({ select: { deviceId: true } });
    const gateway = getGateway();
    const commandPayload = { type, payload: payload || {}, timestamp: Date.now() };
    for (const d of devices) {
      if (gateway) gateway.notifyDevice(d.deviceId, 'COMMAND', commandPayload);
    }
    res.json({ success: true, sentTo: devices.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV !== 'production') {
      console.error('POST /api/devices/commands/broadcast error:', message);
    }
    res.status(500).json({ error: 'Failed to broadcast command' });
  }
});

/**
 * @swagger
 * /api/devices/{deviceId}:
 *   get:
 *     summary: Obter dispositivo
 *     tags: [Devices]
 *     parameters: [{ in: path, name: deviceId, required: true, schema: { type: string } }]
 *     responses:
 *       200: { description: Dispositivo com política }
 *       404: { description: Dispositivo não encontrado }
 */
router.get('/:deviceId', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  try {
    const device = await prisma.device.findUnique({
      where: { deviceId },
      include: { policy: true }
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const formattedDevice = {
      ...device,
      id: device.deviceId,
      lastSeen: new Date(device.lastSeen).getTime(),
      policies: safeParsePolicy(device.policy)
    };

    res.json(formattedDevice);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('GET /api/devices/:id error:', error);
    }
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

router.put('/:deviceId/policies', async (req: Request, res: Response) => {
  const { deviceId } = req.params;

  try {
    const { updatePolicySchema } = require('../middleware/validate');
    const validatedData = updatePolicySchema.parse(req.body);
    const { blockedDomains, allowedApps, blockedApps, screenshotInterval, kioskMode, unlockPin } = validatedData;

    const updateData: PolicyUpdateData = {
      ...(blockedDomains && { blockedDomains: JSON.stringify(blockedDomains) }),
      ...(allowedApps && { allowedApps: JSON.stringify(allowedApps) }),
      ...(blockedApps !== undefined && { blockedApps: JSON.stringify(blockedApps) }),
      ...(screenshotInterval !== undefined && { screenshotInterval }),
      ...(kioskMode !== undefined && { kioskMode }),
      ...(unlockPin !== undefined && { unlockPin })
    };
    const updatedPolicy = await prisma.policy.update({
      where: { deviceId },
      data: updateData as Parameters<typeof prisma.policy.update>[0]['data']
    }) as PolicyWithBlockedApps;

    const policiesPayload = {
      blockedDomains: JSON.parse(updatedPolicy.blockedDomains),
      allowedApps: JSON.parse(updatedPolicy.allowedApps),
      blockedApps: JSON.parse(updatedPolicy.blockedApps ?? '[]'),
      screenshotInterval: updatedPolicy.screenshotInterval,
      kioskMode: updatedPolicy.kioskMode ?? false
    };
    const gatewayPolicy = getGateway();
    if (gatewayPolicy) {
      const deviceWithPolicy = await prisma.device.findUnique({
        where: { deviceId },
        include: { policy: true }
      });
      if (deviceWithPolicy) {
        gatewayPolicy.notifyDevice('all_admins', 'DEVICE_UPDATED', formatDeviceForSocket(deviceWithPolicy));
      }
    }
    getGateway()?.notifyDevice(deviceId, 'COMMAND', {
      type: 'POLICY_CHANGE',
      payload: policiesPayload
    });

    const { logAction } = require('../utils/audit');
    await logAction('ADMIN', 'UPDATE_DEVICE_POLICY', { deviceId, changes: validatedData });

    fireWebhook('policy.updated', {
      deviceId,
      kioskMode: updatedPolicy.kioskMode ?? false,
      hasUnlockPin: !!(updatedPolicy.unlockPin != null && String(updatedPolicy.unlockPin).trim() !== ''),
      blockedDomainsCount: (JSON.parse(updatedPolicy.blockedDomains) as unknown[]).length,
      allowedAppsCount: (JSON.parse(updatedPolicy.allowedApps) as unknown[]).length,
      blockedAppsCount: (JSON.parse(updatedPolicy.blockedApps ?? '[]') as unknown[]).length
    });

    res.json({ success: true, policy: updatedPolicy });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    if (process.env.NODE_ENV !== 'production') {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Policy update error:', err.message);
    }
    res.status(500).json({ error: 'Failed to update policy' });
  }
});

router.put('/:deviceId/heartbeat', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const { currentUrl } = req.body || {};
  try {
    await updateDeviceHeartbeat(prisma, deviceId, {
      lastSeen: new Date(),
      status: 'online',
      currentUrl: typeof currentUrl === 'string' ? currentUrl : undefined
    });
    const device = await prisma.device.findUnique({
      where: { deviceId },
      include: { policy: true }
    });
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const gateway = getGateway();
    if (gateway) {
      gateway.notifyDevice('all_admins', 'DEVICE_UPDATED', formatDeviceForSocket(device));
    }

    fireWebhook('device.heartbeat', {
      deviceId,
      lastSeen: device.lastSeen.getTime(),
      currentUrl: (device as { currentUrl?: string | null }).currentUrl ?? undefined,
      status: device.status
    });

    res.json({ success: true });
  } catch (error) {
    res.status(404).json({ error: 'Device not found' });
  }
});

router.delete('/:deviceId', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  try {
    await prisma.device.delete({ where: { deviceId } });
    fireWebhook('device.deleted', { deviceId });
    res.json({ success: true });
  } catch (error) {
    res.status(404).json({ error: 'Device not found' });
  }
});

const PENDING_COMMANDS_TTL_MS = 5 * 60 * 1000;

router.post('/:deviceId/commands', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const { type, payload } = req.body;

  try {
    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const commandPayload = { type, payload: payload || {}, timestamp: Date.now() };
    const gateway = getGateway();
    if (gateway) {
      gateway.notifyDevice(deviceId, 'COMMAND', commandPayload);
    }

    const pending = await prisma.devicePendingCommand.create({
      data: {
        deviceId,
        type: String(type),
        payload: JSON.stringify(payload ?? {})
      }
    });

    try {
      await prisma.deviceActivityLog.create({
        data: {
          deviceId,
          action: 'COMMAND_SENT',
          details: JSON.stringify({ type, payload: payload || {}, source: 'panel', pendingId: pending.id })
        }
      });
    } catch {
    }

    fireWebhook('command.sent', { deviceId, type: String(type), payload: payload ?? {} });

    res.json({ success: true, id: pending.id });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Command relay error:', err.message);
    }
    res.status(500).json({ error: 'Failed to relay command' });
  }
});

router.get('/:deviceId/commands/pending', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  try {
    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    const since = new Date(Date.now() - PENDING_COMMANDS_TTL_MS);
    const list = await prisma.devicePendingCommand.findMany({
      where: { deviceId, consumedAt: null, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' }
    });
    res.json(list.map(c => ({ id: c.id, type: c.type, payload: JSON.parse(c.payload || '{}'), createdAt: c.createdAt })));
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('GET pending commands error:', error);
    res.status(500).json({ error: 'Failed to fetch pending commands' });
  }
});

router.post('/:deviceId/commands/ack', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const { commandIds } = req.body;
  if (!Array.isArray(commandIds) || commandIds.length === 0) {
    return res.status(400).json({ error: 'commandIds array is required' });
  }
  try {
    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    await prisma.devicePendingCommand.updateMany({
      where: { id: { in: commandIds }, deviceId },
      data: { consumedAt: new Date() }
    });
    res.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('POST commands/ack error:', error);
    res.status(500).json({ error: 'Failed to ack commands' });
  }
});

router.get('/:deviceId/audit', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { details: { contains: deviceId } },
          { action: { contains: 'DEVICE' } }
        ]
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: { user: { select: { name: true } } }
    });
    res.json(logs);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Audit fetch error:', error);
    }
    res.json([]);
  }
});

router.post('/:deviceId/activity', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  try {
    const { action, details } = req.body;
    if (!action || typeof action !== 'string') {
      return res.status(400).json({ error: 'action is required' });
    }
    const device = await prisma.device.findUnique({ where: { deviceId }, include: { policy: true } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const detailsStr = details != null ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;
    const log = await prisma.deviceActivityLog.create({
      data: {
        deviceId,
        action: action.substring(0, 64),
        details: detailsStr
      }
    });

    const urlFromDetails = details && typeof details === 'object' && details.url ? String(details.url) : null;
    if (action === 'URL_CHANGED' && urlFromDetails) {
      await updateDeviceHeartbeat(prisma, deviceId, {
        lastSeen: new Date(),
        status: 'online',
        currentUrl: urlFromDetails
      });
      const updated = await prisma.device.findUnique({ where: { deviceId }, include: { policy: true } });
      if (updated) {
        const gw = getGateway();
        if (gw) gw.notifyDevice('all_admins', 'DEVICE_UPDATED', formatDeviceForSocket(updated));
      }
    }

    if (action === 'BLOCKED_SITE') {
      const blockedUrlPayload = details && typeof details === 'object' && (details as { url?: string }).url
        ? String((details as { url: string }).url)
        : (detailsStr ? (() => { try { const o = JSON.parse(detailsStr); return o?.url ?? ''; } catch { return ''; } })() : '');
      const url = blockedUrlPayload || 'site bloqueado';
      await prisma.notification.create({
        data: {
          deviceId,
          type: 'warning',
          title: 'Tentativa de acesso a site bloqueado',
          message: `${device.name || deviceId} tentou acessar: ${typeof url === 'string' ? url : 'site bloqueado'}`
        }
      });
      const gw = getGateway();
      if (gw) {
        gw.notifyDevice('all_admins', 'BLOCKED_SITE_ATTEMPT', {
          deviceId,
          deviceName: device.name ?? deviceId,
          url: typeof url === 'string' ? url : detailsStr,
          timestamp: Date.now()
        });
      }
    }

    const gateway = getGateway();
    if (gateway) {
      gateway.notifyDevice('all_admins', 'DEVICE_ACTIVITY', {
        deviceId,
        deviceName: device?.name ?? deviceId,
        id: log.id,
        action: log.action,
        details: log.details,
        timestamp: log.timestamp
      });
    }

    fireWebhook('device.activity', {
      deviceId,
      deviceName: device?.name ?? deviceId,
      action: log.action,
      details: log.details,
      logId: log.id
    });

    res.status(201).json(log);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Activity log error:', err.message);
    }
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

router.get('/:deviceId/activity', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
  try {
    const logs = await prisma.deviceActivityLog.findMany({
      where: { deviceId },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
    res.json(logs);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Activity fetch error:', error);
    }
    res.json([]);
  }
});

router.post('/:deviceId/unlock-validate', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const { pin } = req.body;
  try {
    const device = await prisma.device.findUnique({
      where: { deviceId },
      include: { policy: true }
    });
    if (!device) return res.status(404).json({ error: 'Device not found' });
    const policy = device.policy as { unlockPin?: string | null } | null;
    const expectedPin = policy?.unlockPin;
    if (expectedPin == null || expectedPin === '') {
      return res.status(400).json({ error: 'Unlock PIN not configured for this device' });
    }
    if (typeof pin !== 'string') {
      return res.status(400).json({ error: 'pin is required' });
    }
    if (pin !== expectedPin) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    res.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') console.error('unlock-validate error:', error);
    res.status(500).json({ error: 'Validation failed' });
  }
});

setInterval(async () => {
  const fiveMinutesAgo = new Date(Date.now() - 300000);
  try {
    await prisma.device.updateMany({
      where: {
        lastSeen: { lt: fiveMinutesAgo },
        status: 'online'
      },
      data: { status: 'offline' }
    });
  } catch (error) {
    console.error('Offline task error:', error);
  }
}, 60000);

router.post('/:deviceId/android-management/enroll', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const { enterpriseName, policyId } = req.body;

  try {
    const androidMgmt = getAndroidManagementService();
    if (!androidMgmt) {
      return res.status(503).json({ error: 'Android Management API not configured' });
    }
    const token = await androidMgmt.createEnrollmentToken(enterpriseName, policyId || deviceId);

    if (!token) {
      return res.status(500).json({ error: 'Failed to create enrollment token' });
    }

    await prisma.device.update({
      where: { deviceId },
      data: { enrollmentToken: token.value }
    });

    res.json({ success: true, token });
  } catch (error: any) {
    console.error('Enrollment error:', error);
    res.status(500).json({ error: 'Failed to enroll device' });
  }
});

router.put('/:deviceId/android-management/link', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const { androidManagementName } = req.body;

  try {
    if (!androidManagementName || typeof androidManagementName !== 'string') {
      return res.status(400).json({ error: 'androidManagementName is required' });
    }
    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    await prisma.device.update({
      where: { deviceId },
      data: { androidManagementName: androidManagementName.trim() }
    });
    res.json({ success: true, androidManagementName: androidManagementName.trim() });
  } catch (error: any) {
    console.error('Link AMAPI device error:', error);
    res.status(500).json({ error: 'Failed to link device' });
  }
});

router.post('/:deviceId/android-management/lock', async (req: Request, res: Response) => {
  const { deviceId } = req.params;

  try {
    const androidMgmt = getAndroidManagementService();
    if (!androidMgmt) {
      return res.status(503).json({ error: 'Android Management API not configured. Set GOOGLE_CLOUD_PROJECT_ID and GOOGLE_SERVICE_ACCOUNT_PATH.' });
    }

    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device || !device.androidManagementName) {
      return res.status(404).json({ error: 'Device not enrolled in Android Management' });
    }

    const result = await androidMgmt.issueCommand(device.androidManagementName, 'LOCK');
    if (!result) {
      return res.status(503).json({ error: 'Failed to lock device via AMAPI' });
    }

    res.json({ success: true, result });
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Lock command error:', error);
    }
    res.status(503).json({ error: 'Android Management API error. Check configuration.' });
  }
});

router.post('/:deviceId/android-management/reboot', async (req: Request, res: Response) => {
  const { deviceId } = req.params;

  try {
    const androidMgmt = getAndroidManagementService();
    if (!androidMgmt) {
      return res.status(503).json({ error: 'Android Management API not configured. Set GOOGLE_CLOUD_PROJECT_ID and GOOGLE_SERVICE_ACCOUNT_PATH.' });
    }

    const device = await prisma.device.findUnique({ where: { deviceId } });
    if (!device || !device.androidManagementName) {
      return res.status(404).json({ error: 'Device not enrolled in Android Management' });
    }

    const result = await androidMgmt.issueCommand(device.androidManagementName, 'REBOOT');
    if (!result) {
      return res.status(503).json({ error: 'Failed to reboot device via AMAPI' });
    }

    res.json({ success: true, result });
  } catch (error: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Reboot command error:', error);
    }
    res.status(503).json({ error: 'Android Management API error. Check configuration.' });
  }
});

router.post('/:deviceId/android-management/reset-password', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const { newPassword } = req.body;

  try {
    const device = await prisma.device.findUnique({ where: { deviceId } });

    if (!device || !device.androidManagementName) {
      return res.status(404).json({ error: 'Device not enrolled in Android Management' });
    }

    const androidMgmt = getAndroidManagementService();
    if (!androidMgmt) {
      return res.status(503).json({ error: 'Android Management API not configured' });
    }
    const result = await androidMgmt.issueCommand(device.androidManagementName, 'RESET_PASSWORD', {
      newPassword,
      flags: ['REQUIRE_ENTRY']
    });

    if (!result) {
      return res.status(500).json({ error: 'Failed to reset password' });
    }

    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
