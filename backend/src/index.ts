import 'dotenv/config';
import './helperFunction';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { initSocket } from './socket';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './lib/prisma';
import { triggerAutoAssign } from './services/autoAssign';
import { initWebPush } from './services/webPush';
import { getRedis } from './services/redis';
import { startOperationalScheduler, getSchedulerStatus } from './modules/scheduler/schedulerService';
import authRoutes from './routes/auth';
import deliveryRoutes from './routes/deliveries';
import slotRoutes from './routes/slots';
import dashboardRoutes from './routes/dashboard';
import unitRoutes from './routes/units';
import zoneRoutes from './routes/zones';
import brandRoutes from './routes/brand';
import trackRoutes from './routes/track';
import analyticsRoutes from './routes/analytics';
import userRoutes from './routes/users';
import reportsRoutes from './routes/reports';
import pushRoutes from './routes/push';
import awVendorRoutes from './routes/awVendors';
import deviceRoutes from './routes/devices';
import auditLogRoutes from './routes/auditLogs';
import historiesRoutes from './routes/histories';
import superadminRoutes from './routes/superadmin';
import configRoutes from './routes/config';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/aw-vendors', awVendorRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/histories', historiesRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/config', configRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/scheduler', (_req, res) => res.json({ status: 'ok', scheduler: getSchedulerStatus() }));

app.use(errorHandler);

const server = createServer(app);
initSocket(server);

async function start() {
  await prisma.$connect();
  console.log('Database connected');
  await getRedis();
  console.log('Redis connected');

  // Seed default UI settings config if not already present (never overwrite admin changes)
  await prisma.appConfig.upsert({
    where: { key: 'ui.settings' },
    update: {},
    create: {
      key: 'ui.settings',
      value: { toastDurationSeconds: 3 },
      category: 'ui',
      description: 'Cài đặt giao diện — thời gian hiển thị toast notification (giây). Mặc định: 3',
      isRuntimeEditable: true,
    },
  }).catch(console.error);

  initWebPush();

  server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });

  const scheduler = startOperationalScheduler();

  // Graceful shutdown
  function shutdown(signal: string) {
    console.log(`\n[scheduler] Received ${signal}, shutting down...`);
    scheduler.stop();
    server.close(() => {
      prisma.$disconnect().then(() => {
        console.log('[scheduler] Shutdown complete');
        process.exit(0);
      });
    });
    // Force exit after 10s if graceful shutdown hangs
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // On startup: drain the full WAITING backlog for all units.
  // Loop until no more assignments are made (handles multi-capacity motorbike slots).
  const startupUnits = await prisma.unitConfig.findMany({
    where: { isActive: true, businessLocation: { isActive: true } },
    select: { unit: true, id: true, businessLocationId: true },
    orderBy: [{ businessLocationId: 'asc' }, { unit: 'asc' }],
  });

  for (const unitConfig of startupUnits) {
    (async () => {
      let assigned: number;
      do {
        assigned = await triggerAutoAssign(unitConfig.unit, {
          unitConfigId: unitConfig.id,
          businessLocationId: unitConfig.businessLocationId,
        });
      } while (assigned > 0);
    })().catch(console.error);
  }
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
