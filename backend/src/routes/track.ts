import { Router, Request, Response } from 'express';
import { DeliveryStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { getTrackDelivery } from '../services/trackRealtime';
import { publicLookupLimiter } from '../middleware/rateLimit';

// ─── Ticket code format: UNIT-VTYPE + 3-digit sequence ───────────────────────
const UNIT_TICKET_PREFIX: Record<string, string> = {
  EMART: 'EMART', THISKYHALL: 'THISKY', TENANT: 'MALL',
};
const VT_TICKET_PREFIX: Record<string, string> = {
  TRUCK: 'T', MOTORBIKE: 'M', OTHER: 'X',
};
export function formatTicketCode(unit: string, vehicleType: string, n: number): string {
  const up = UNIT_TICKET_PREFIX[unit] ?? unit;
  const vp = VT_TICKET_PREFIX[vehicleType] ?? 'X';
  return `${up}-${vp}${String(n).padStart(3, '0')}`;
}

const router = Router();

// GET /api/track/search?plate= — look up registration code by vehicle plate (read-only)
router.get('/search', publicLookupLimiter, asyncHandler(async (req: Request, res: Response) => {
  const plate = typeof req.query.plate === 'string' ? req.query.plate.trim().toUpperCase() : '';
  if (!plate) {
    res.status(400).json({ error: 'Vui lòng nhập biển số xe' });
    return;
  }

  // Find most recent non-expired/cancelled delivery for this plate
  const delivery = await prisma.deliveryRegistration.findFirst({
    where: {
      vehiclePlate: plate,
      status: { notIn: ['CANCELLED', 'EXPIRED'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { registrationCode: true, status: true, receivingUnit: true, driverName: true },
  });

  if (!delivery) {
    res.status(404).json({ error: `Không tìm thấy lượt đăng ký nào cho biển số ${plate}` });
    return;
  }

  res.json({ registrationCode: delivery.registrationCode });
}));

// GET /api/track/:code — public, no sensitive fields
// When status=WAITING, also returns queueInfo { position, totalWaiting, estimatedWaitMinutes, availableSlots }
router.get('/:code', asyncHandler(async (req: Request, res: Response) => {
  const delivery = await getTrackDelivery(req.params.code);
  if (!delivery) { res.status(404).json({ error: 'Không tìm thấy đăng ký' }); return; }
  res.json(delivery);
}));

// POST /api/track/active-session
// Accepts an array of codes, returns the single most relevant active code (if any).
// Priority: WAITING/CALLED > REGISTERED > Others (not COMPLETED/CANCELLED/EXPIRED).
router.post('/active-session', asyncHandler(async (req: Request, res: Response) => {
  const { codes } = req.body as { codes?: string[] };
  if (!Array.isArray(codes) || codes.length === 0) {
    res.json({ activeCode: null });
    return;
  }
  const cleanCodes = codes.map(c => typeof c === 'string' ? c.trim().toUpperCase() : '').filter(Boolean);
  if (cleanCodes.length === 0) {
    res.json({ activeCode: null });
    return;
  }

  const deliveries = await prisma.deliveryRegistration.findMany({
    where: {
      registrationCode: { in: cleanCodes },
      status: { notIn: ['COMPLETED', 'CANCELLED', 'EXPIRED'] },
    },
    select: { registrationCode: true, status: true, requestedTime: true },
  });

  if (deliveries.length === 0) {
    res.json({ activeCode: null });
    return;
  }

  // Find priority
  let best = deliveries[0];
  const priority = (d: typeof deliveries[0]) => {
    if (d.status === 'CALLED') return 4;
    if (d.status === 'WAITING') return 3;
    if (d.status === 'RECEIVING' || d.status === 'AUTO_WAREHOUSE_RECEIVING') return 2;
    if (d.status === 'REGISTERED') return 1;
    return 0;
  };

  for (let i = 1; i < deliveries.length; i++) {
    const d = deliveries[i];
    const pD = priority(d);
    const pBest = priority(best);
    if (pD > pBest) {
      best = d;
    } else if (pD === pBest) {
      // If both are REGISTERED, prefer the one with requestedTime closest to now
      if (pD === 1 && d.requestedTime && best.requestedTime) {
        if (d.requestedTime < best.requestedTime) {
          best = d;
        }
      }
    }
  }

  res.json({ activeCode: best.registrationCode });
}));

export default router;
