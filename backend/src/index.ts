import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { ReceivingUnit } from '@prisma/client';
import { initSocket } from './socket';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './lib/prisma';
import { triggerAutoAssign } from './services/autoAssign';
import { expireStaleDeliveries } from './services/expireStale';
import { initWebPush } from './services/webPush';
import authRoutes from './routes/auth';
import deliveryRoutes from './routes/deliveries';
import slotRoutes from './routes/slots';
import dashboardRoutes from './routes/dashboard';
import unitRoutes from './routes/units';
import zoneRoutes from './routes/zones';
import brandRoutes from './routes/brand';
import trackRoutes from './routes/track';
import staffPinsRoutes from './routes/staffPins';
import analyticsRoutes from './routes/analytics';
import userRoutes from './routes/users';
import reportsRoutes from './routes/reports';
import checkinRoutes from './routes/checkin';
import pushRoutes from './routes/push';

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
app.use('/api/staff-pins', staffPinsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/checkin', checkinRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const server = createServer(app);
initSocket(server);

async function start() {
  await prisma.$connect();
  console.log('Database connected');

  server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });

  // On startup: auto-expire past-day REGISTERED/WAITING records.
  expireStaleDeliveries()
    .then((r) => { if (r.total > 0) console.log(`[expire] Archived ${r.total} stale records (registered=${r.expiredRegistered}, waiting=${r.expiredWaiting})`); })
    .catch(console.error);

  // Re-run every hour so overnight records are expired at next business day start.
  setInterval(() => {
    expireStaleDeliveries()
      .then((r) => { if (r.total > 0) console.log(`[expire] Hourly: archived ${r.total} stale records`); })
      .catch(console.error);
  }, 60 * 60 * 1000);

  // On startup: drain the full WAITING backlog for all units.
  // Loop until no more assignments are made (handles multi-capacity motorbike slots).
  for (const unit of Object.values(ReceivingUnit)) {
    (async () => {
      let assigned: number;
      do {
        assigned = await triggerAutoAssign(unit);
      } while (assigned > 0);
    })().catch(console.error);
  }
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
