import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.config';
import { generalLimiter } from './middleware/rate-limit.middleware';
import authRoutes from './routes/auth';
import screenshotsRoutes from './routes/screenshots';
import devicesRoutes from './routes/devices';
import policiesRoutes from './routes/policies';
import androidManagementRoutes from './routes/android-management';
import globalPoliciesRoutes from './routes/global-policies';

import { createServer } from 'http';
import { initGateway } from './socket/gateway';
import { getAndroidManagementService } from './services/android-management-singleton';

const app = express();
const httpServer = createServer(app);

initGateway(httpServer);

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(generalLimiter);

const requestHistory: any[] = [];
app.use((req, res, next) => {
  requestHistory.push({ method: req.method, url: req.url, timestamp: new Date().toISOString() });
  if (requestHistory.length > 50) requestHistory.shift();
  next();
});

app.get('/api/debug/requests', (req, res) => {
  res.json(requestHistory);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Octoclass MDM API Docs'
}));

app.use('/api/auth', authRoutes);
app.use('/api/screenshots', screenshotsRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/policies', policiesRoutes);
app.use('/api/android-management', androidManagementRoutes);
app.use('/api/global-policies', globalPoliciesRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = 3005;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

