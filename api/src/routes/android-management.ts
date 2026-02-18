import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { generalLimiter } from '../middleware/rate-limit.middleware';
import { getAndroidManagementService } from '../services/android-management-singleton';

const router = Router();

/**
 * @swagger
 * /api/android-management/signup-url:
 *   post:
 *     summary: Criar signup URL para registro de empresa
 *     tags: [Android Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               callbackUrl:
 *                 type: string
 *                 default: https://localhost
 *     responses:
 *       200:
 *         description: Signup URL criada
 */
router.post('/signup-url', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  const androidMgmtService = getAndroidManagementService();
  if (!androidMgmtService) {
    return res.status(503).json({ error: 'Android Management API not configured' });
  }

  try {
    const { callbackUrl } = req.body;
    const signupData = await androidMgmtService.createSignupUrl(callbackUrl);

    if (!signupData) {
      return res.status(500).json({ error: 'Failed to create signup URL' });
    }

    res.json({ success: true, data: signupData });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/android-management/enterprise/complete:
 *   post:
 *     summary: Completar registro de empresa com token
 *     tags: [Android Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enterpriseToken
 *               - signupUrlName
 *             properties:
 *               enterpriseToken:
 *                 type: string
 *               signupUrlName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Empresa registrada
 */
router.post('/enterprise/complete', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  const androidMgmtService = getAndroidManagementService();
  if (!androidMgmtService) {
    return res.status(503).json({ error: 'Android Management API not configured' });
  }

  try {
    const { enterpriseToken, signupUrlName } = req.body;

    if (!enterpriseToken || !signupUrlName) {
      return res.status(400).json({ error: 'enterpriseToken and signupUrlName are required' });
    }

    const enterprise = await androidMgmtService.completeEnterpriseRegistration(
      enterpriseToken,
      signupUrlName
    );

    if (!enterprise) {
      return res.status(500).json({ error: 'Failed to complete enterprise registration' });
    }

    res.json({ success: true, data: enterprise });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/android-management/enterprise/{enterpriseName}:
 *   get:
 *     summary: Obter informações da empresa
 *     tags: [Android Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: enterpriseName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dados da empresa
 */
router.get('/enterprise/:enterpriseName', authMiddleware, async (req: Request, res: Response) => {
  const androidMgmtService = getAndroidManagementService();
  if (!androidMgmtService) {
    return res.status(503).json({ error: 'Android Management API not configured' });
  }

  try {
    const { enterpriseName } = req.params;
    const enterprise = await androidMgmtService.getEnterprise(enterpriseName);

    if (!enterprise) {
      return res.status(404).json({ error: 'Enterprise not found' });
    }

    res.json({ success: true, data: enterprise });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/android-management/policies:
 *   post:
 *     summary: Criar política de gerenciamento
 *     tags: [Android Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enterpriseName
 *               - policyId
 *             properties:
 *               enterpriseName:
 *                 type: string
 *               policyId:
 *                 type: string
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: Política criada
 */
router.post('/policies', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  const androidMgmtService = getAndroidManagementService();
  if (!androidMgmtService) {
    return res.status(503).json({ error: 'Android Management API not configured' });
  }

  try {
    const { enterpriseName, policyId, options } = req.body;

    if (!enterpriseName || !policyId) {
      return res.status(400).json({ error: 'enterpriseName and policyId are required' });
    }

    const policy = await androidMgmtService.createPolicy(enterpriseName, policyId, options || {});

    if (!policy) {
      return res.status(500).json({ error: 'Failed to create policy' });
    }

    res.json({ success: true, data: policy });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/android-management/enrollment-tokens:
 *   post:
 *     summary: Criar token de registro (enrollment)
 *     tags: [Android Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enterpriseName
 *               - policyId
 *             properties:
 *               enterpriseName:
 *                 type: string
 *               policyId:
 *                 type: string
 *               durationSeconds:
 *                 type: number
 *                 default: 3600
 *     responses:
 *       200:
 *         description: Token criado com QR code
 */
router.post('/enrollment-tokens', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  const androidMgmtService = getAndroidManagementService();
  if (!androidMgmtService) {
    return res.status(503).json({ error: 'Android Management API not configured' });
  }

  try {
    const { enterpriseName, policyId, durationSeconds } = req.body;

    if (!enterpriseName || !policyId) {
      return res.status(400).json({ error: 'enterpriseName and policyId are required' });
    }

    const token = await androidMgmtService.createEnrollmentToken(
      enterpriseName,
      policyId,
      durationSeconds || 3600
    );

    if (!token) {
      return res.status(500).json({ error: 'Failed to create enrollment token' });
    }

    res.json({ success: true, data: token });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/android-management/devices:
 *   get:
 *     summary: Listar dispositivos
 *     tags: [Android Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: enterpriseName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de dispositivos
 */
router.get('/devices', authMiddleware, async (req: Request, res: Response) => {
  const androidMgmtService = getAndroidManagementService();
  if (!androidMgmtService) {
    return res.status(503).json({ error: 'Android Management API not configured' });
  }

  try {
    const { enterpriseName } = req.query;

    if (!enterpriseName || typeof enterpriseName !== 'string') {
      return res.status(400).json({ error: 'enterpriseName query parameter is required' });
    }

    const devices = await androidMgmtService.listDevices(enterpriseName);
    res.json({ success: true, data: devices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/android-management/devices/{deviceName}:
 *   get:
 *     summary: Obter informações detalhadas do dispositivo
 *     tags: [Android Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dados do dispositivo
 */
router.get('/devices/:deviceName', authMiddleware, async (req: Request, res: Response) => {
  const androidMgmtService = getAndroidManagementService();
  if (!androidMgmtService) {
    return res.status(503).json({ error: 'Android Management API not configured' });
  }

  try {
    const { deviceName } = req.params;
    const device = await androidMgmtService.getDevice(deviceName);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ success: true, data: device });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/android-management/devices/{deviceName}/commands:
 *   post:
 *     summary: Enviar comando para dispositivo
 *     tags: [Android Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceName
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - commandType
 *             properties:
 *               commandType:
 *                 type: string
 *                 enum: [LOCK, REBOOT, RESET_PASSWORD]
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: Comando enviado
 */
router.post('/devices/:deviceName/commands', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  const androidMgmtService = getAndroidManagementService();
  if (!androidMgmtService) {
    return res.status(503).json({ error: 'Android Management API not configured' });
  }

  try {
    const { deviceName } = req.params;
    const { commandType, options } = req.body;

    if (!commandType) {
      return res.status(400).json({ error: 'commandType is required' });
    }

    if (!['LOCK', 'REBOOT', 'RESET_PASSWORD'].includes(commandType)) {
      return res.status(400).json({ error: 'Invalid commandType' });
    }

    const result = await androidMgmtService.issueCommand(deviceName, commandType, options || {});

    if (!result) {
      return res.status(500).json({ error: 'Failed to issue command' });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/android-management/devices/{deviceName}:
 *   delete:
 *     summary: Remover dispositivo (factory reset)
 *     tags: [Android Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Dispositivo removido
 */
router.delete('/devices/:deviceName', authMiddleware, generalLimiter, async (req: Request, res: Response) => {
  const androidMgmtService = getAndroidManagementService();
  if (!androidMgmtService) {
    return res.status(503).json({ error: 'Android Management API not configured' });
  }

  try {
    const { deviceName } = req.params;
    const success = await androidMgmtService.deleteDevice(deviceName);

    if (!success) {
      return res.status(500).json({ error: 'Failed to delete device' });
    }

    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
