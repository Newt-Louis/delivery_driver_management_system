import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Raw SQL result type from PostgreSQL
interface LiveStat {
  unit: string;
  vehicleType: string;
  goodsType: string;
  avgMinutes: number;
  sampleCount: bigint;
}

// GET /api/analytics/receiving-times
// Returns all ReceivingTimeConfig rows enriched with live historical stats
router.get('/receiving-times', authenticate, requireRole('ADMIN', 'RECEIVING'), asyncHandler(async (_req: Request, res: Response) => {
  const [configs, liveStats, totalCompleted] = await Promise.all([
    prisma.receivingTimeConfig.findMany({
      orderBy: [{ unit: 'asc' }, { vehicleType: 'asc' }, { goodsType: 'asc' }],
    }),
    prisma.$queryRaw<LiveStat[]>`
      SELECT
        receiving_unit      AS unit,
        vehicle_type        AS "vehicleType",
        goods_type          AS "goodsType",
        AVG(EXTRACT(EPOCH FROM (completed_time - receiving_start_time)) / 60)::float AS "avgMinutes",
        COUNT(*)::bigint AS "sampleCount"
      FROM delivery_registrations
      WHERE status = 'COMPLETED'
        AND receiving_start_time IS NOT NULL
        AND completed_time IS NOT NULL
        AND completed_time > receiving_start_time
      GROUP BY receiving_unit, vehicle_type, goods_type
    `,
    prisma.deliveryRegistration.count({
      where: {
        status: 'COMPLETED',
        receivingStartTime: { not: null },
        completedTime:      { not: null },
      },
    }),
  ]);

  const liveMap = new Map(
    liveStats.map((s) => [`${s.unit}|${s.vehicleType}|${s.goodsType}`, s]),
  );

  const result = configs.map((cfg) => {
    const live = liveMap.get(`${cfg.unit}|${cfg.vehicleType}|${cfg.goodsType}`);
    const liveAvg = live ? Math.round(live.avgMinutes * 10) / 10 : null;
    const liveSampleCount = live ? Number(live.sampleCount) : 0;
    const diffMinutes = liveAvg !== null ? Math.round((liveAvg - cfg.configuredMinutes) * 10) / 10 : null;
    const confidence: 'high' | 'medium' | 'low' =
      liveSampleCount >= 20 ? 'high' : liveSampleCount >= 5 ? 'medium' : 'low';
    const shouldUpdate = liveAvg !== null && Math.abs(liveAvg - cfg.configuredMinutes) > 2;

    return {
      ...cfg,
      configuredMinutes: cfg.configuredMinutes,
      liveAvgMinutes: liveAvg,
      liveSampleCount,
      diffMinutes,
      confidence,
      shouldUpdate,
    };
  });

  res.json({ configs: result, totalCompleted });
}));

// POST /api/analytics/receiving-times/analyze
// Recalculates recommendations from historical data and saves to DB
router.post('/receiving-times/analyze', authenticate, requireRole('ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  const liveStats = await prisma.$queryRaw<LiveStat[]>`
    SELECT
      receiving_unit      AS unit,
      vehicle_type        AS "vehicleType",
      goods_type          AS "goodsType",
      AVG(EXTRACT(EPOCH FROM (completed_time - receiving_start_time)) / 60)::float AS "avgMinutes",
      COUNT(*)::bigint AS "sampleCount"
    FROM delivery_registrations
    WHERE status = 'COMPLETED'
      AND receiving_start_time IS NOT NULL
      AND completed_time IS NOT NULL
      AND completed_time > receiving_start_time
    GROUP BY receiving_unit, vehicle_type, goods_type
  `;

  let updated = 0;
  for (const stat of liveStats) {
    const avgMinutes = Math.round(stat.avgMinutes * 10) / 10;
    const sampleCount = Number(stat.sampleCount);
    try {
      await prisma.receivingTimeConfig.updateMany({
        where: {
          unit:        stat.unit as never,
          vehicleType: stat.vehicleType as never,
          goodsType:   stat.goodsType as never,
        },
        data: {
          recommendedMinutes: avgMinutes,
          sampleCount,
          lastAnalyzedAt: new Date(),
        },
      });
      updated++;
    } catch {
      // Skip if config row doesn't exist yet for this combination
    }
  }

  res.json({ analyzed: liveStats.length, updated, message: `Đã phân tích ${liveStats.length} nhóm, cập nhật ${updated} cấu hình` });
}));

// PATCH /api/analytics/receiving-times/:id/accept
// Accepts the recommended minutes as the new configured value
router.patch('/receiving-times/:id/accept', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const cfg = await prisma.receivingTimeConfig.findUnique({ where: { id: req.params.id } });
  if (!cfg) { res.status(404).json({ error: 'Không tìm thấy cấu hình' }); return; }
  if (cfg.recommendedMinutes === null) {
    res.status(400).json({ error: 'Chưa có khuyến nghị để chấp nhận. Chạy phân tích trước.' }); return;
  }
  const updated = await prisma.receivingTimeConfig.update({
    where: { id: req.params.id },
    data: { configuredMinutes: cfg.recommendedMinutes },
  });
  res.json(updated);
}));

// PATCH /api/analytics/receiving-times/accept-all
// Accepts ALL pending recommendations
router.patch('/receiving-times/accept-all', authenticate, requireRole('ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  const pending = await prisma.receivingTimeConfig.findMany({
    where: { recommendedMinutes: { not: null } },
  });
  let accepted = 0;
  for (const cfg of pending) {
    if (cfg.recommendedMinutes !== null && Math.abs(cfg.recommendedMinutes - cfg.configuredMinutes) > 0.05) {
      await prisma.receivingTimeConfig.update({
        where: { id: cfg.id },
        data: { configuredMinutes: cfg.recommendedMinutes },
      });
      accepted++;
    }
  }
  res.json({ accepted, message: `Đã chấp nhận ${accepted} khuyến nghị` });
}));

export default router;
