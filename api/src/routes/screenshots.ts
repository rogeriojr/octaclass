import express, { Request, Response } from 'express';
import prisma from '../prisma';
import { screenshotUploadSchema } from '../middleware/validate';

const router = express.Router();

router.post('/upload', async (req: Request, res: Response) => {
  try {
    const parsed = screenshotUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Dados inválidos', details: parsed.error.flatten() });
    }
    const { deviceId, image, timestamp, event, url, tabId } = parsed.data;

    const screenshot = await prisma.screenshot.create({
      data: {
        deviceId,
        data: image,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        event: event || 'MANUAL',
        url,
        tabId
      }
    });

    const count = await prisma.screenshot.count({ where: { deviceId } });
    if (count > 100) {
      const oldestScreenshots = await prisma.screenshot.findMany({
        where: { deviceId },
        orderBy: { timestamp: 'asc' },
        take: count - 100
      });

      await prisma.screenshot.deleteMany({
        where: { id: { in: oldestScreenshots.map((s: any) => s.id) } }
      });
    }

    res.json({ success: true, id: screenshot.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save screenshot' });
  }
});

router.get('/history/:deviceId', async (req: Request, res: Response) => {
  const { deviceId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 50);
  const inline = req.query.inline === '1' || req.query.inline === 'true';

  try {
    const history = await prisma.screenshot.findMany({
      where: { deviceId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        deviceId: true,
        timestamp: true,
        event: true,
        url: true,
        tabId: true,
        title: true,
        ...(inline ? { data: true } : {})
      }
    });

    const list = history.map((s: any) => {
      const item: any = {
        id: s.id,
        deviceId: s.deviceId,
        timestamp: s.timestamp,
        event: s.event,
        url: s.url,
        tabId: s.tabId,
        title: s.title
      };
      if (inline && s.data) {
        const raw = s.data.startsWith('data:') ? s.data : `data:image/jpeg;base64,${s.data}`;
        item.dataUrl = raw;
      }
      return item;
    });

    res.json(list);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Screenshots history error:', error);
    }
    res.json([]);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const screenshot = await prisma.screenshot.findUnique({
      where: { id }
    });

    if (!screenshot || !screenshot.data) {
      res.setHeader('Content-Type', 'image/jpeg');
      return res.status(404).end();
    }

    const rawBase64 = screenshot.data.startsWith('data:')
      ? screenshot.data.replace(/^data:image\/\w+;base64,/, '')
      : screenshot.data;
    const img = Buffer.from(rawBase64, 'base64');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': img.length
    });
    res.end(img);
  } catch {
    res.setHeader('Content-Type', 'image/jpeg');
    res.status(500).end();
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.screenshot.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete screenshot' });
  }
});

export default router;
