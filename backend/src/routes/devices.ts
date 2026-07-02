import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { DeviceType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { recordAuditLog, userActor } from '../services/auditLog';

const router = Router();

const SAFE_SELECT = {
  id: true,
  code: true,
  name: true,
  businessLocationId: true,
  businessLocation: { select: { id: true, code: true, locationName: true } },
  deviceType: true,
  isActive: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const createSchema = z.object({
  code: z.string().min(2).max(40).toUpperCase(),
  name: z.string().min(1).max(100),
  businessLocationId: z.string().min(1),
  deviceType: z.nativeEnum(DeviceType).default(DeviceType.KIOSK),
  deviceSecret: z.string().min(6, 'Device secret tối thiểu 6 ký tự').max(100),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.omit({ code: true, businessLocationId: true }).partial();

router.get('/', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (_req: Request, res: Response) => {
  const devices = await prisma.device.findMany({
    select: SAFE_SELECT,
    orderBy: [{ isActive: 'desc' }, { deviceType: 'asc' }, { code: 'asc' }],
  });
  res.json(devices);
}));

router.post('/', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const body = createSchema.parse(req.body);

  const location = await prisma.businessLocation.findUnique({ where: { id: body.businessLocationId } });
  if (!location) {
    res.status(400).json({ error: 'BusinessLocation không tồn tại.' });
    return;
  }

  const exists = await prisma.device.findUnique({ where: { code: body.code } });
  if (exists) {
    res.status(409).json({ error: `Mã thiết bị ${body.code} đã tồn tại.` });
    return;
  }

  const deviceSecretHash = await bcrypt.hash(body.deviceSecret, 10);
  const device = await prisma.device.create({
    data: {
      code: body.code,
      name: body.name,
      businessLocationId: body.businessLocationId,
      deviceType: body.deviceType,
      deviceSecretHash,
      isActive: body.isActive ?? true,
    },
    select: SAFE_SELECT,
  });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'device.create',
    targetType: 'Device',
    targetId: device.id,
    businessLocationId: device.businessLocationId,
    after: {
      code: device.code,
      name: device.name,
      deviceType: device.deviceType,
      isActive: device.isActive,
    },
  });
  res.status(201).json(device);
}));

router.patch('/:id', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const body = updateSchema.parse(req.body);
  const existing = await prisma.device.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const deviceSecretHash = body.deviceSecret
    ? await bcrypt.hash(body.deviceSecret, 10)
    : undefined;

  const device = await prisma.device.update({
    where: { id: req.params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.deviceType !== undefined ? { deviceType: body.deviceType } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(deviceSecretHash ? { deviceSecretHash } : {}),
    },
    select: SAFE_SELECT,
  });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'device.update',
    targetType: 'Device',
    targetId: device.id,
    businessLocationId: device.businessLocationId,
    before: {
      code: existing.code,
      name: existing.name,
      deviceType: existing.deviceType,
      isActive: existing.isActive,
    },
    after: {
      code: device.code,
      name: device.name,
      deviceType: device.deviceType,
      isActive: device.isActive,
      secretRotated: Boolean(body.deviceSecret),
    },
  });
  res.json(device);
}));

router.delete('/:id', authenticate, requireRole('SUPERADMIN', 'ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const existing = await prisma.device.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  const device = await prisma.device.update({
    where: { id: req.params.id },
    data: { isActive: false },
    select: SAFE_SELECT,
  });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'device.deactivate',
    targetType: 'Device',
    targetId: device.id,
    businessLocationId: device.businessLocationId,
    before: {
      code: existing.code,
      name: existing.name,
      deviceType: existing.deviceType,
      isActive: existing.isActive,
    },
    after: {
      code: device.code,
      name: device.name,
      deviceType: device.deviceType,
      isActive: device.isActive,
    },
  });
  res.json({ deactivated: true, device });
}));

export default router;
