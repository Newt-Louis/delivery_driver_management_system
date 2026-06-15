import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/zones — all zones with slot counts
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const zones = await prisma.zone.findMany({
    orderBy: { code: 'asc' },
    include: {
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
});

// POST /api/zones — create zone (admin)
router.post('/', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const body = zoneSchema.parse(req.body);
  const exists = await prisma.zone.findUnique({ where: { code: body.code } });
  if (exists) {
    res.status(409).json({ error: 'Conflict', message: `Mã khu "${body.code}" đã tồn tại.` });
    return;
  }
  const zone = await prisma.zone.create({ data: body });
  res.status(201).json(zone);
}));

// PATCH /api/zones/:id — update zone (admin)
router.patch('/:id', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const body = zoneSchema.partial().parse(req.body);
  const zone = await prisma.zone.update({ where: { id: req.params.id }, data: body });
  res.json(zone);
}));

// DELETE /api/zones/:id — only if no slots assigned (admin)
router.delete('/:id', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const zone = await prisma.zone.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { slots: true } } },
  });
  if (!zone) { res.status(404).json({ error: 'Not found' }); return; }
  if (zone._count.slots > 0) {
    res.status(400).json({ error: 'BadRequest', message: `Khu "${zone.code}" còn ${zone._count.slots} slot. Hãy chuyển slot sang khu khác trước khi xóa.` });
    return;
  }
  await prisma.zone.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
}));

export default router;
