import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole, enforceScope, enforceResourceScope } from '../middleware/auth';

const router = Router();

// GET /api/zones — all zones with slot counts
router.get('/', authenticate, enforceScope, asyncHandler(async (req: Request, res: Response) => {
  const where: Record<string, unknown> = {};
  if (req.scope?.businessLocationId) {
    where.unitConfig = { businessLocationId: req.scope.businessLocationId };
  }
  if (req.scope?.unitConfigId) {
    where.unitConfigId = req.scope.unitConfigId;
  }
  const zones = await prisma.zone.findMany({
    where,
    orderBy: { code: 'asc' },
    include: {
      unitConfig: { select: { id: true, unit: true, displayName: true, businessLocationId: true } },
      _count: { select: { slots: true } },
      slots: {
        where: { isActive: true },
        orderBy: [{ vehicleType: 'asc' }, { code: 'asc' }],
        select: { id: true, code: true, name: true, vehicleType: true, assignedUnit: true, status: true, isActive: true },
      },
    },
  });
  res.json(zones);
}));

const zoneSchema = z.object({
  code: z.string().min(1).max(10).toUpperCase(),
  name: z.string().min(1).max(100),
  unitConfigId: z.string().min(1),
});

// POST /api/zones — create zone (admin)
router.post('/', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const body = zoneSchema.parse(req.body);
  const unitConfig = await prisma.unitConfig.findUnique({ where: { id: body.unitConfigId } });
  if (!unitConfig) {
    res.status(400).json({ error: 'BadRequest', message: 'Unit config không tồn tại.' });
    return;
  }
  if (!enforceResourceScope(req, res, unitConfig.businessLocationId)) return;
  const exists = await prisma.zone.findUnique({
    where: { unitConfigId_code: { unitConfigId: body.unitConfigId, code: body.code } },
  });
  if (exists) {
    res.status(409).json({ error: 'Conflict', message: `Mã khu "${body.code}" đã tồn tại trong đơn vị này.` });
    return;
  }
  const zone = await prisma.zone.create({ data: body });
  res.status(201).json(zone);
}));

// PATCH /api/zones/:id — update zone (admin)
router.patch('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.zone.findUnique({
    where: { id: req.params.id },
    include: { unitConfig: { select: { businessLocationId: true } } },
  });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  if (!enforceResourceScope(req, res, existing.unitConfig.businessLocationId)) return;

  const body = zoneSchema.partial().parse(req.body);
  if (body.unitConfigId) {
    const unitConfig = await prisma.unitConfig.findUnique({ where: { id: body.unitConfigId } });
    if (!unitConfig) {
      res.status(400).json({ error: 'BadRequest', message: 'Unit config không tồn tại.' });
      return;
    }
    if (!enforceResourceScope(req, res, unitConfig.businessLocationId)) return;
  }
  const zone = await prisma.zone.update({ where: { id: req.params.id }, data: body });
  res.json(zone);
}));

// DELETE /api/zones/:id — only if no slots assigned (admin)
router.delete('/:id', authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const zone = await prisma.zone.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { slots: true } }, unitConfig: { select: { businessLocationId: true } } },
  });
  if (!zone) { res.status(404).json({ error: 'Not found' }); return; }
  if (!enforceResourceScope(req, res, zone.unitConfig.businessLocationId)) return;
  if (zone._count.slots > 0) {
    res.status(400).json({ error: 'BadRequest', message: `Khu "${zone.code}" còn ${zone._count.slots} slot. Hãy chuyển slot sang khu khác trước khi xóa.` });
    return;
  }
  await prisma.zone.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
}));

export default router;
