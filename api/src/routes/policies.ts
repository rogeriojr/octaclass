import express, { Request, Response } from 'express';
import prisma from '../prisma';

const router = express.Router();

const seedDefaults = async () => {
  const count = await prisma.policyTemplate.count();
  if (count === 0) {
    const defaults = [
      {
        name: 'Modo Estrito',
        description: 'Bloqueio total de redes sociais e apps não educacionais',
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
        screenshotInterval: 30000,
        kioskMode: true
      },
      {
        name: 'Modo Moderado',
        description: 'Bloqueio de redes sociais principais, permite YouTube educacional',
        blockedDomains: JSON.stringify([
          'facebook.com', 'fb.com', 'instagram.com', 'tiktok.com',
          'twitter.com', 'x.com', 'snapchat.com'
        ]),
        allowedApps: JSON.stringify([
          'com.android.calculator2',
          'com.google.android.keep',
          'com.google.android.youtube',
          'com.octoclass'
        ]),
        screenshotInterval: 60000,
        kioskMode: true
      },
      {
        name: 'Modo Flexível',
        description: 'Monitoramento básico, poucas restrições',
        blockedDomains: JSON.stringify(['facebook.com', 'instagram.com', 'tiktok.com']),
        allowedApps: JSON.stringify(['*']),
        screenshotInterval: 300000,
        kioskMode: false
      }
    ];

    for (const template of defaults) {
      await prisma.policyTemplate.create({ data: template });
    }
  }
};

seedDefaults();

router.get('/', async (req: Request, res: Response) => {
  try {
    const templates = await prisma.policyTemplate.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const formattedTemplates = templates.map((t: any) => ({
      ...t,
      blockedDomains: JSON.parse(t.blockedDomains),
      allowedApps: JSON.parse(t.allowedApps)
    }));

    res.json(formattedTemplates);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch policy templates' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const template = await prisma.policyTemplate.findUnique({
      where: { id }
    });

    if (!template) {
      return res.status(404).json({ error: 'Policy template not found' });
    }

    const formattedTemplate = {
      ...template,
      blockedDomains: JSON.parse(template.blockedDomains),
      allowedApps: JSON.parse(template.allowedApps)
    };

    res.json(formattedTemplate);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch policy template' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { updatePolicySchema } = require('../middleware/validate');
    const validatedData = updatePolicySchema.parse(req.body);
    const { name, description, blockedDomains, allowedApps, screenshotInterval, kioskMode } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Policy name is required' });
    }

    const template = await prisma.policyTemplate.create({
      data: {
        name,
        description: description || '',
        blockedDomains: blockedDomains ? JSON.stringify(blockedDomains) : '[]',
        allowedApps: allowedApps ? JSON.stringify(allowedApps) : '[]',
        screenshotInterval: screenshotInterval || 60000,
        kioskMode: kioskMode !== undefined ? kioskMode : true
      }
    });

    const { logAction } = require('../utils/audit');
    await logAction('ADMIN', 'CREATE_POLICY_TEMPLATE', { templateId: template.id, name: template.name });

    res.json({ success: true, template });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Create policy error:', error);
    res.status(500).json({ error: 'Failed to create policy template' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, blockedDomains, allowedApps, screenshotInterval, kioskMode } = req.body;

  try {
    const updatedTemplate = await prisma.policyTemplate.update({
      where: { id },
      data: {
        name,
        description,
        blockedDomains: blockedDomains ? JSON.stringify(blockedDomains) : undefined,
        allowedApps: allowedApps ? JSON.stringify(allowedApps) : undefined,
        screenshotInterval,
        kioskMode
      }
    });

    res.json({ success: true, template: updatedTemplate });
  } catch (error) {
    res.status(404).json({ error: 'Policy template not found' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await prisma.policyTemplate.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(404).json({ error: 'Policy template not found' });
  }
});

export default router;
