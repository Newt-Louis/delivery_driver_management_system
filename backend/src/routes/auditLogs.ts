import { Router, Request, Response } from 'express';
import { AuditActorType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

const querySchema = z.object({
  businessLocationId: z.string().optional(),
  unitConfigId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  actorType: z.nativeEnum(AuditActorType).optional(),
  actorId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

router.get('/', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const query = querySchema.parse(req.query);

  const where: Prisma.AuditLogWhereInput = {
    ...(query.businessLocationId ? { businessLocationId: query.businessLocationId } : {}),
    ...(query.unitConfigId ? { unitConfigId: query.unitConfigId } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.targetId ? { targetId: query.targetId } : {}),
    ...(query.actorType ? { actorType: query.actorType } : {}),
    ...(query.actorId ? { actorId: query.actorId } : {}),
    ...((query.from || query.to)
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > query.limit;
  const data = hasMore ? rows.slice(0, query.limit) : rows;
  res.json({
    data,
    nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
  });
}));

export default router;
