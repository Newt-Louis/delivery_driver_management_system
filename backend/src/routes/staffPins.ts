import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { recordAuditLog, userActor } from '../services/auditLog';

const router = Router();

const staffPinSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum([Role.CHECKIN, Role.RECEIVING]),
  pin:  z.string().regex(/^\d{4}$/, 'PIN phải là 4 chữ số'),
  active: z.boolean().optional(),
});

// All routes require a location/system admin account.
router.use(authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC'));

// GET /api/staff-pins
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const pins = await prisma.staffPin.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  res.json(pins);
}));

// POST /api/staff-pins
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const data = staffPinSchema.parse(req.body);
  const existing = await prisma.staffPin.findUnique({ where: { pin: data.pin } });
  if (existing) {
    res.status(409).json({ error: 'PIN đã được sử dụng bởi nhân viên khác' }); return;
  }
  const pin = await prisma.staffPin.create({ data });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'staff_pin.create',
    targetType: 'StaffPin',
    targetId: pin.id,
    after: { name: pin.name, role: pin.role },
  });
  res.status(201).json(pin);
}));

// PATCH /api/staff-pins/:id
router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.staffPin.findUnique({ where: { id: req.params.id }, select: { name: true, role: true, pin: true } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const data = staffPinSchema.partial().parse(req.body);
  if (data.pin) {
    const existingPin = await prisma.staffPin.findFirst({
      where: { pin: data.pin, id: { not: req.params.id } },
    });
    if (existingPin) {
      res.status(409).json({ error: 'PIN đã được sử dụng bởi nhân viên khác' }); return;
    }
  }
  const updated = await prisma.staffPin.update({ where: { id: req.params.id }, data });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'staff_pin.update',
    targetType: 'StaffPin',
    targetId: updated.id,
    before: { name: existing.name, role: existing.role },
    after: { name: updated.name, role: updated.role },
  });
  res.json(updated);
}));

// DELETE /api/staff-pins/:id
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.staffPin.findUnique({ where: { id: req.params.id }, select: { name: true, role: true } });
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  await prisma.staffPin.delete({ where: { id: req.params.id } });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'staff_pin.delete',
    targetType: 'StaffPin',
    targetId: req.params.id,
    before: { name: existing.name, role: existing.role },
  });
  res.json({ success: true });
}));

export default router;
