import express, { Request, Response } from 'express';
import prisma from '../prisma';
import { getGateway } from '../socket/gateway';
import { updateGlobalPolicySchema } from '../middleware/validate';

const router = express.Router();

const seedDefaultGlobalPolicy = async () => {
  const count = await prisma.globalPolicy.count();
  if (count === 0) {
    await prisma.globalPolicy.create({
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
};

seedDefaultGlobalPolicy();

/**
 * @swagger
 * /api/global-policies:
 *   get:
 *     summary: Get global policy
 *     tags: [Global Policies]
 *     responses:
 *       200:
 *         description: Global policy retrieved successfully
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    let globalPolicy = await prisma.globalPolicy.findFirst();

    if (!globalPolicy) {
      await seedDefaultGlobalPolicy();
      globalPolicy = await prisma.globalPolicy.findFirst();
    }

    if (!globalPolicy) {
      return res.status(404).json({ error: 'Global policy not found' });
    }

    const formattedPolicy = {
      ...globalPolicy,
      blockedDomains: JSON.parse(globalPolicy.blockedDomains),
      allowedApps: JSON.parse(globalPolicy.allowedApps)
    };

    res.json(formattedPolicy);
  } catch (error) {
    console.error('Get global policy error:', error);
    res.status(500).json({ error: 'Failed to fetch global policy' });
  }
});

/**
 * @swagger
 * /api/global-policies:
 *   put:
 *     summary: Update global policy
 *     tags: [Global Policies]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               blockedDomains:
 *                 type: array
 *                 items:
 *                   type: string
 *               allowedApps:
 *                 type: array
 *                 items:
 *                   type: string
 *               screenshotInterval:
 *                 type: number
 *               kioskMode:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Global policy updated successfully
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const parsed = updateGlobalPolicySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const { blockedDomains, allowedApps, screenshotInterval, kioskMode } = parsed.data;

    let globalPolicy = await prisma.globalPolicy.findFirst();

    if (!globalPolicy) {
      await seedDefaultGlobalPolicy();
      globalPolicy = await prisma.globalPolicy.findFirst();
    }

    if (!globalPolicy) {
      return res.status(500).json({ error: 'Failed to initialize global policy' });
    }

    const updatedPolicy = await prisma.globalPolicy.update({
      where: { id: globalPolicy.id },
      data: {
        blockedDomains: blockedDomains ? JSON.stringify(blockedDomains) : undefined,
        allowedApps: allowedApps ? JSON.stringify(allowedApps) : undefined,
        screenshotInterval,
        kioskMode
      }
    });

    const gateway = getGateway();
    if (gateway) {
      const devices = await prisma.device.findMany();
      devices.forEach(device => {
        gateway.notifyDevice(device.deviceId, 'COMMAND', {
          type: 'POLICY_CHANGE',
          payload: {
            blockedDomains: JSON.parse(updatedPolicy.blockedDomains),
            allowedApps: JSON.parse(updatedPolicy.allowedApps),
            screenshotInterval: updatedPolicy.screenshotInterval,
            kioskMode: updatedPolicy.kioskMode
          }
        });
      });
    }

    const { logAction } = require('../utils/audit');
    await logAction('ADMIN', 'UPDATE_GLOBAL_POLICY', { changes: req.body });

    res.json({
      success: true,
      policy: {
        ...updatedPolicy,
        blockedDomains: JSON.parse(updatedPolicy.blockedDomains),
        allowedApps: JSON.parse(updatedPolicy.allowedApps)
      }
    });
  } catch (error) {
    console.error('Update global policy error:', error);
    res.status(500).json({ error: 'Failed to update global policy' });
  }
});

/**
 * @swagger
 * /api/global-policies/blacklist:
 *   post:
 *     summary: Add domain to blacklist
 *     tags: [Global Policies]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               domain:
 *                 type: string
 *     responses:
 *       200:
 *         description: Domain added to blacklist
 */
router.post('/blacklist', async (req: Request, res: Response) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    let globalPolicy = await prisma.globalPolicy.findFirst();

    if (!globalPolicy) {
      await seedDefaultGlobalPolicy();
      globalPolicy = await prisma.globalPolicy.findFirst();
    }

    if (!globalPolicy) {
      return res.status(500).json({ error: 'Failed to initialize global policy' });
    }

    const currentList = JSON.parse(globalPolicy.blockedDomains);

    if (currentList.includes(domain)) {
      return res.status(400).json({ error: 'Domain already in blacklist' });
    }

    const updatedList = [...currentList, domain];

    const updatedPolicy = await prisma.globalPolicy.update({
      where: { id: globalPolicy.id },
      data: {
        blockedDomains: JSON.stringify(updatedList)
      }
    });

    const gateway = getGateway();
    if (gateway) {
      const devices = await prisma.device.findMany();
      devices.forEach(device => {
        gateway.notifyDevice(device.deviceId, 'COMMAND', {
          type: 'POLICY_CHANGE',
          payload: { blockedDomains: updatedList }
        });
      });
    }

    res.json({ success: true, blockedDomains: updatedList });
  } catch (error) {
    console.error('Add to blacklist error:', error);
    res.status(500).json({ error: 'Failed to add domain to blacklist' });
  }
});

/**
 * @swagger
 * /api/global-policies/blacklist/{domain}:
 *   delete:
 *     summary: Remove domain from blacklist
 *     tags: [Global Policies]
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Domain removed from blacklist
 */
router.delete('/blacklist/:domain', async (req: Request, res: Response) => {
  try {
    const { domain } = req.params;

    let globalPolicy = await prisma.globalPolicy.findFirst();

    if (!globalPolicy) {
      return res.status(404).json({ error: 'Global policy not found' });
    }

    const currentList = JSON.parse(globalPolicy.blockedDomains);
    const updatedList = currentList.filter((d: string) => d !== decodeURIComponent(domain));

    const updatedPolicy = await prisma.globalPolicy.update({
      where: { id: globalPolicy.id },
      data: {
        blockedDomains: JSON.stringify(updatedList)
      }
    });

    const gateway = getGateway();
    if (gateway) {
      const devices = await prisma.device.findMany();
      devices.forEach(device => {
        gateway.notifyDevice(device.deviceId, 'COMMAND', {
          type: 'POLICY_CHANGE',
          payload: { blockedDomains: updatedList }
        });
      });
    }

    res.json({ success: true, blockedDomains: updatedList });
  } catch (error) {
    console.error('Remove from blacklist error:', error);
    res.status(500).json({ error: 'Failed to remove domain from blacklist' });
  }
});

/**
 * @swagger
 * /api/global-policies/whitelist:
 *   post:
 *     summary: Add app to whitelist
 *     tags: [Global Policies]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               packageName:
 *                 type: string
 *     responses:
 *       200:
 *         description: App added to whitelist
 */
router.post('/whitelist', async (req: Request, res: Response) => {
  try {
    const { packageName } = req.body;

    if (!packageName) {
      return res.status(400).json({ error: 'Package name is required' });
    }

    let globalPolicy = await prisma.globalPolicy.findFirst();

    if (!globalPolicy) {
      await seedDefaultGlobalPolicy();
      globalPolicy = await prisma.globalPolicy.findFirst();
    }

    if (!globalPolicy) {
      return res.status(500).json({ error: 'Failed to initialize global policy' });
    }

    const currentList = JSON.parse(globalPolicy.allowedApps);

    if (currentList.includes(packageName)) {
      return res.status(400).json({ error: 'App already in whitelist' });
    }

    const updatedList = [...currentList, packageName];

    const updatedPolicy = await prisma.globalPolicy.update({
      where: { id: globalPolicy.id },
      data: {
        allowedApps: JSON.stringify(updatedList)
      }
    });

    const gateway = getGateway();
    if (gateway) {
      const devices = await prisma.device.findMany();
      devices.forEach(device => {
        gateway.notifyDevice(device.deviceId, 'COMMAND', {
          type: 'POLICY_CHANGE',
          payload: { allowedApps: updatedList }
        });
      });
    }

    res.json({ success: true, allowedApps: updatedList });
  } catch (error) {
    console.error('Add to whitelist error:', error);
    res.status(500).json({ error: 'Failed to add app to whitelist' });
  }
});

/**
 * @swagger
 * /api/global-policies/whitelist/{packageName}:
 *   delete:
 *     summary: Remove app from whitelist
 *     tags: [Global Policies]
 *     parameters:
 *       - in: path
 *         name: packageName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: App removed from whitelist
 */
router.delete('/whitelist/:packageName', async (req: Request, res: Response) => {
  try {
    const { packageName } = req.params;

    let globalPolicy = await prisma.globalPolicy.findFirst();

    if (!globalPolicy) {
      return res.status(404).json({ error: 'Global policy not found' });
    }

    const currentList = JSON.parse(globalPolicy.allowedApps);
    const updatedList = currentList.filter((p: string) => p !== decodeURIComponent(packageName));

    const updatedPolicy = await prisma.globalPolicy.update({
      where: { id: globalPolicy.id },
      data: {
        allowedApps: JSON.stringify(updatedList)
      }
    });

    const gateway = getGateway();
    if (gateway) {
      const devices = await prisma.device.findMany();
      devices.forEach(device => {
        gateway.notifyDevice(device.deviceId, 'COMMAND', {
          type: 'POLICY_CHANGE',
          payload: { allowedApps: updatedList }
        });
      });
    }

    res.json({ success: true, allowedApps: updatedList });
  } catch (error) {
    console.error('Remove from whitelist error:', error);
    res.status(500).json({ error: 'Failed to remove app from whitelist' });
  }
});

export default router;
